import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { QuizAttemptEntity } from './quiz-attemp.entity';
import { QuizEntity } from 'src/quiz/quiz.entity';
import { QuestionEntity } from 'src/question/question.entity';
import { StudentAnswerEntity } from 'src/student-answer/student_answer.entity';
import { ChoiceEntity } from 'src/choice/choise.entity';
import { EnrollmentService } from 'src/enrollment/enrollment.service';

export type AttemptResult = {
  attemptId: number;
  quizId: number;
  submitted: true;
  score: number;
  totalMarks: number;
  percentage: number;
  passMark: number;
  passed: boolean;
  submittedAt: Date;
};

@Injectable()
export class QuizAttemptService {
  constructor(
    @InjectRepository(QuizAttemptEntity)
    private attemptRepo: Repository<QuizAttemptEntity>,
    @InjectRepository(QuizEntity)
    private quizRepo: Repository<QuizEntity>,
    private enrollService: EnrollmentService,
  ) {}

  /**
   * Start the student's one attempt on an exam, or resume it.
   * - first call: creates the attempt, deadline = now + timeLimit minutes
   * - later calls before the deadline: returns the same attempt, same deadline
   * - already submitted: 409 with the result
   * - deadline passed and not submitted: the saved answers are graded and the attempt
   *   is closed (auto-submit), then 409 with the result
   */
  public async startAttempt(quizId: number, studentId: number) {
    const quiz = await this.quizRepo.findOne({
      where: { id: quizId },
      relations: { course: true },
      select: { id: true, isPublished: true, timeLimit: true, course: { id: true } },
    });
    if (!quiz || !quiz.isPublished) throw new NotFoundException('Exam not found');

    const enrolled = await this.enrollService.verifyStudentEnrollment(studentId, quiz.course.id);
    if (!enrolled) throw new ForbiddenException('You need to enroll in the course first');

    // the transaction returns a value; any 409 is thrown after it commits,
    // otherwise the auto-submit grading would be rolled back
    const outcome = await this.attemptRepo.manager.transaction(async (manager) => {
      // shared row lock: students starting together do not wait for each other,
      // but an instructor edit (exclusive lock) and a start never overlap
      const locked = await manager.findOne(QuizEntity, {
        where: { id: quizId },
        lock: { mode: 'pessimistic_read' },
      });
      if (!locked || !locked.isPublished) throw new NotFoundException('Exam not found');

      const existing = await manager.findOne(QuizAttemptEntity, {
        where: { quiz: { id: quizId }, user: { id: studentId } },
      });
      const now = new Date();

      if (existing) {
        if (!existing.submitted && existing.expiresAt.getTime() > now.getTime()) {
          const saved = await manager.find(StudentAnswerEntity, { where: { attempt: { id: existing.id } }, loadRelationIds: true, order: { id: 'ASC' } });
          return { kind: 'resumed' as const, attempt: existing, now, answers: saved.map((a) => ({ questionId: a.question as any as number, choiceId: a.choice as any as number })) };
        }
        const result = await this.finalize(manager, existing.id, quizId, now);
        return { kind: 'finished' as const, result };
      }

      const attempt = manager.create(QuizAttemptEntity, {
        quiz: { id: quizId },
        user: { id: studentId },
        attemptNumber: 1,
        submitted: false,
        score: 0,
        passed: false,
        expiresAt: new Date(now.getTime() + locked.timeLimit * 60_000),
        submittedAt: null,
      });
      const saved = await manager.save(attempt);
      return { kind: 'created' as const, attempt: saved, now, answers: [] as { questionId: number; choiceId: number }[] };
    });

    if (outcome.kind === 'finished') {
      throw new ConflictException({
        message: 'This exam is already finished, you cannot start it again',
        result: outcome.result,
      });
    }
    return this.toResponse(outcome.attempt, quizId, outcome.kind === 'resumed', outcome.now, outcome.answers);
  }

  /**
   * Submit the student's attempt. Grades the answers saved on the server.
   * Calling it again returns the same result. A submit after the deadline is graded
   * the same way as an auto-submit and is stamped with the deadline time.
   */
  public async submitAttempt(attemptId: number, studentId: number): Promise<AttemptResult> {
    return this.attemptRepo.manager.transaction(async (manager) => {
      const attempt = await manager.findOne(QuizAttemptEntity, {
        where: { id: attemptId },
        loadRelationIds: true,
      });
      // someone else's attempt looks the same as a missing one
      if (!attempt || (attempt.user as any) !== studentId) throw new NotFoundException('Attempt not found');
      return this.finalize(manager, attemptId, attempt.quiz as any, new Date());
    });
  }

  /**
   * Save (or change) the student's selected choice for one question.
   * One row per (attempt, question): a change updates it. Locks the attempt row, so it
   * is serialized with submit/auto-submit: an answer either lands before grading or is refused.
   * After the deadline nothing is saved; the attempt is graded and closed (409 with result).
   */
  public async saveAnswer(attemptId: number, studentId: number, questionId: number, choiceId: number) {
    const outcome = await this.attemptRepo.manager.transaction(async (manager) => {
      const attempt = await manager.findOne(QuizAttemptEntity, {
        where: { id: attemptId },
        loadRelationIds: true,
        lock: { mode: 'pessimistic_write' },
      });
      if (!attempt || (attempt.user as any) !== studentId) throw new NotFoundException('Attempt not found');
      const quizId = attempt.quiz as any as number;
      const now = new Date();

      if (attempt.submitted) throw new ConflictException('This attempt is already submitted');
      if (attempt.expiresAt.getTime() <= now.getTime()) {
        return { kind: 'finished' as const, result: await this.finalize(manager, attemptId, quizId, now) };
      }

      const question = await manager.findOne(QuestionEntity, { where: { id: questionId, quiz: { id: quizId } } });
      if (!question) throw new NotFoundException('Question not found in this exam');
      const choice = await manager.findOne(ChoiceEntity, { where: { id: choiceId, question: { id: questionId } } });
      if (!choice) throw new NotFoundException('Choice not found for this question');

      const existing = await manager.findOne(StudentAnswerEntity, { where: { attempt: { id: attemptId }, question: { id: questionId } } });
      if (existing) await manager.update(StudentAnswerEntity, existing.id, { choice: { id: choiceId } });
      else await manager.insert(StudentAnswerEntity, { attempt: { id: attemptId }, question: { id: questionId }, choice: { id: choiceId } });
      return { kind: 'saved' as const, expiresAt: attempt.expiresAt, now };
    });
    if (outcome.kind === 'finished') {
      throw new ConflictException({ message: 'Time has ended, your saved answers were submitted', result: outcome.result });
    }
    return { attemptId, questionId, choiceId, expiresAt: outcome.expiresAt, serverNow: outcome.now };
  }

  /**
   * Close an attempt and grade it. Runs inside a transaction. Locks the attempt row
   * so a submit and an auto-submit racing each other grade it once.
   */
  private async finalize(manager: EntityManager, attemptId: number, quizId: number, now: Date): Promise<AttemptResult> {
    const attempt = await manager.findOne(QuizAttemptEntity, {
      where: { id: attemptId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    const quiz = await manager.findOne(QuizEntity, { where: { id: quizId } });
    if (!quiz) throw new NotFoundException('Exam not found');

    if (attempt.submitted) return this.toResult(attempt, quizId, quiz, attempt.score, await this.totalMarksOf(manager, quizId));

    const answers = await manager.find(StudentAnswerEntity, {
      where: { attempt: { id: attemptId } },
      relations: { question: { quiz: true }, choice: { question: true } },
      order: { id: 'ASC' },
    });

    // one answer per question (the latest wins); only a choice that belongs to the
    // question, on a question of this exam, can earn marks. Correctness comes from the
    // choice rows, not from what the answer row says.
    const latest = new Map<number, StudentAnswerEntity>();
    for (const a of answers) latest.set(a.question.id, a);
    let score = 0;
    const graded: StudentAnswerEntity[] = [];
    for (const a of latest.values()) {
      const valid = a.question.quiz?.id === quizId && a.choice?.question?.id === a.question.id;
      const correct = valid && a.choice.isCorrect === true;
      a.isCorrect = correct;
      a.earnedMark = correct ? a.question.mark : 0;
      score += a.earnedMark;
      graded.push(a);
    }
    if (graded.length) await manager.save(StudentAnswerEntity, graded.map(({ id, isCorrect, earnedMark }) => ({ id, isCorrect, earnedMark })));

    const total = await this.totalMarksOf(manager, quizId);
    attempt.score = score;
    attempt.passed = total > 0 ? (score * 100) / total >= quiz.passMark : quiz.passMark === 0;
    attempt.submitted = true;
    // late or auto-submit: record the deadline, not the time we noticed
    attempt.submittedAt = now.getTime() > attempt.expiresAt.getTime() ? attempt.expiresAt : now;
    const saved = await manager.save(attempt);
    return this.toResult(saved, quizId, quiz, score, total);
  }

  // the real sum of the exam's question marks (does not trust a stale stored totalMarks)
  private async totalMarksOf(manager: EntityManager, quizId: number): Promise<number> {
    return (await manager.sum(QuestionEntity, 'mark', { quiz: { id: quizId } })) ?? 0;
  }

  private toResult(a: QuizAttemptEntity, quizId: number, quiz: QuizEntity, score: number, total?: number): AttemptResult {
    const totalMarks = total ?? quiz.totalMarks;
    return {
      attemptId: a.id,
      quizId,
      submitted: true,
      score,
      totalMarks,
      percentage: totalMarks > 0 ? Math.round((score * 10000) / totalMarks) / 100 : 0,
      passMark: quiz.passMark,
      passed: a.passed,
      submittedAt: a.submittedAt as Date,
    };
  }

  private toResponse(a: QuizAttemptEntity, quizId: number, resumed: boolean, now: Date, answers: { questionId: number; choiceId: number }[]) {
    return {
      attemptId: a.id,
      quizId,
      startedAt: a.startedAt,
      expiresAt: a.expiresAt,
      serverNow: now,
      resumed,
      // only the student's own saved selections; never whether they are correct
      answers,
    };
  }
}
