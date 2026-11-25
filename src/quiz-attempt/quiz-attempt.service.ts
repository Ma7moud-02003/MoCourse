import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuizAttemptEntity } from './quiz-attemp.entity';
import { QuizEntity } from 'src/quiz/quiz.entity';
import { EnrollmentService } from 'src/enrollment/enrollment.service';

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
   * - already submitted: 409
   * - deadline passed and not submitted: 409 (grading and auto-submit are a later step)
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

    return this.attemptRepo.manager.transaction(async (manager) => {
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
        if (existing.submitted) throw new ConflictException('You already submitted this exam');
        if (existing.expiresAt.getTime() <= now.getTime()) {
          throw new ConflictException('The time for this exam has ended');
        }
        return this.toResponse(existing, quizId, true, now);
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
      return this.toResponse(saved, quizId, false, now);
    });
  }

  private toResponse(a: QuizAttemptEntity, quizId: number, resumed: boolean, now: Date) {
    return {
      attemptId: a.id,
      quizId,
      startedAt: a.startedAt,
      expiresAt: a.expiresAt,
      serverNow: now,
      resumed,
    };
  }
}
