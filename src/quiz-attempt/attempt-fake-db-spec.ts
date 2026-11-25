// In-memory stand-in for the DB used by the attempt tests (no real Postgres).
import { QuizEntity } from 'src/quiz/quiz.entity';
import { QuizAttemptEntity } from './quiz-attemp.entity';
import { StudentAnswerEntity } from 'src/student-answer/student_answer.entity';
import { QuestionEntity } from 'src/question/question.entity';
import { ChoiceEntity } from 'src/choice/choise.entity';
import { QuizAttemptService } from './quiz-attempt.service';

const tick = () => new Promise((r) => setTimeout(r, 1));

export type FakeOpts = {
  published?: boolean;
  enrolled?: boolean;
  timeLimit?: number;
  passMark?: number;
  attempts?: any[];
  // questions: id -> { mark, choices: [{ id, isCorrect }] }
  questions?: Record<number, { mark: number; choices: { id: number; isCorrect: boolean }[] }>;
  // saved answers: { attemptId, questionId, choiceId }
  answers?: { attemptId: number; questionId: number; choiceId: number }[];
  quizOfQuestion?: Record<number, number>;
};

export function fakeAttemptDb(opts: FakeOpts = {}) {
  const questions = opts.questions ?? {};
  const state = {
    quiz: { id: 10, isPublished: opts.published ?? true, timeLimit: opts.timeLimit ?? 30, passMark: opts.passMark ?? 60, totalMarks: 999, course: { id: 5 } } as any,
    attempts: (opts.attempts ?? []).map((a) => ({ ...a })) as any[],
    answers: (opts.answers ?? []).map((a, i) => ({ id: i + 1, isCorrect: false, earnedMark: 0, ...a })) as any[],
    lockModes: [] as string[],
  };
  const answerView = (a: any) => {
    const q = questions[a.questionId];
    const choice = q?.choices.find((c) => c.id === a.choiceId);
    // a choice id that exists on another question is looked up across all questions
    const owner = Object.entries(questions).find(([, qq]) => qq.choices.some((c) => c.id === a.choiceId));
    const ch = owner ? owner[1].choices.find((c) => c.id === a.choiceId)! : choice;
    return {
      id: a.id,
      isCorrect: a.isCorrect,
      earnedMark: a.earnedMark,
      question: { id: a.questionId, mark: q?.mark ?? 0, quiz: { id: opts.quizOfQuestion?.[a.questionId] ?? 10 } },
      choice: ch ? { id: ch.id, isCorrect: ch.isCorrect, question: { id: owner ? Number(owner[0]) : a.questionId } } : undefined,
    };
  };
  let mutex: Promise<void> = Promise.resolve();
  const transaction = async (fn: any) => {
    const prev = mutex;
    let release!: () => void;
    mutex = new Promise<void>((r) => (release = r));
    await prev;
    // a failed transaction must undo its writes
    const snapshot = JSON.stringify({ attempts: state.attempts, answers: state.answers });
    try {
      const manager: any = {
        findOne: async (entity: any, o: any) => {
          await tick();
          if (entity === QuizEntity) {
            if (o?.lock) state.lockModes.push(o.lock.mode);
            return { ...state.quiz };
          }
          const w = o.where;
          if (entity === QuestionEntity) {
            if (!questions[w.id] || (opts.quizOfQuestion?.[w.id] ?? 10) !== w.quiz.id) return null;
            return { id: w.id, mark: questions[w.id].mark };
          }
          if (entity === ChoiceEntity) {
            const c = questions[w.question.id]?.choices.find((x) => x.id === w.id);
            return c ? { id: c.id } : null;
          }
          if (entity === StudentAnswerEntity) {
            const a = state.answers.find((x) => x.attemptId === w.attempt.id && x.questionId === w.question.id);
            return a ? { id: a.id } : null;
          }
          const a = w.id !== undefined ? state.attempts.find((x) => x.id === w.id) : state.attempts.find((x) => x.quiz.id === w.quiz.id && x.user.id === w.user.id);
          if (!a) return null;
          if (o.loadRelationIds) return { ...a, user: a.user.id, quiz: a.quiz.id };
          return a;
        },
        find: async (entity: any, o: any) => {
          await tick();
          if (entity === StudentAnswerEntity && o.loadRelationIds) return state.answers.filter((a) => a.attemptId === o.where.attempt.id).map((a) => ({ id: a.id, question: a.questionId, choice: a.choiceId }));
          if (entity === StudentAnswerEntity) return state.answers.filter((a) => a.attemptId === o.where.attempt.id).map(answerView);
          return [];
        },
        sum: async (entity: any) => {
          await tick();
          if (entity !== QuestionEntity) return null;
          const vals = Object.values(questions);
          return vals.length ? vals.reduce((t, q) => t + q.mark, 0) : null;
        },
        update: async (_e: any, id: number, patch: any) => {
          await tick();
          Object.assign(state.answers.find((x) => x.id === id), { choiceId: patch.choice.id });
        },
        insert: async (_e: any, v: any) => {
          await tick();
          state.answers.push({ id: state.answers.length + 1, isCorrect: false, earnedMark: 0, attemptId: v.attempt.id, questionId: v.question.id, choiceId: v.choice.id });
        },
        create: (_e: any, x: any) => ({ ...x }),
        save: async (a: any, b?: any) => {
          await tick();
          if (b !== undefined) {
            // save(StudentAnswerEntity, partials)
            for (const p of b) Object.assign(state.answers.find((x) => x.id === p.id), { isCorrect: p.isCorrect, earnedMark: p.earnedMark });
            return b;
          }
          if (state.attempts.includes(a)) return a;
          const row = { id: state.attempts.length + 1, startedAt: new Date(), ...a };
          state.attempts.push(row);
          return row;
        },
      };
      return await fn(manager);
    } catch (e) {
      const snap = JSON.parse(snapshot, (k, v) => (typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) ? new Date(v) : v));
      state.attempts = snap.attempts;
      state.answers = snap.answers;
      throw e;
    } finally {
      release();
    }
  };
  const attemptRepo: any = { manager: { transaction } };
  const quizRepo: any = { findOne: jest.fn(async () => ({ ...state.quiz })) };
  const enroll: any = { verifyStudentEnrollment: jest.fn(async () => opts.enrolled ?? true) };
  const service = new QuizAttemptService(attemptRepo, quizRepo, enroll);
  return { service, state, enroll };
}

export { QuizAttemptEntity };
