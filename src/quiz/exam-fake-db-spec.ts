// Tiny in-memory stand-in for the DB used by the exam tests.
// transaction(): the quiz row lock is held until the transaction ends, like pessimistic_write.
import { QuestionEntity } from 'src/question/question.entity';

const tick = () => new Promise((r) => setTimeout(r, 1));

export function fakeExamDb(opts: { published: boolean; questionIds: number[]; ownerId?: number; marks?: Record<number, number> }) {
  const state = {
    quiz: { id: 10, isPublished: opts.published, title: 'Quiz', course: { Instractor: { id: opts.ownerId ?? 3 } } } as any,
    questions: [...opts.questionIds],
    marks: { ...(opts.marks ?? {}) } as Record<number, number>,
  };
  let locked: Promise<void> = Promise.resolve();

  const makeManager = () => {
    let release: (() => void) | null = null;
    const manager: any = {
      findOne: async (_entity: any, o: any) => {
        if (o?.lock) {
          const prev = locked;
          let r!: () => void;
          locked = new Promise<void>((res) => (r = res));
          await prev;
          release = r;
        }
        await tick();
        return { ...state.quiz };
      },
      count: async (_entity: any) => {
        await tick();
        return state.questions.length;
      },
      sum: async (_entity: any, _col: string) => {
        await tick();
        if (!state.questions.length) return null;
        return state.questions.reduce((t, id) => t + (state.marks[id] ?? 1), 0);
      },
      update: async (_entity: any, _where: any, patch: any) => {
        await tick();
        state.quiz = { ...state.quiz, ...patch };
      },
      remove: async (q: any) => {
        await tick();
        state.questions = state.questions.filter((id) => id !== q.id);
        return q;
      },
      save: async (q: any) => {
        await tick();
        if (Array.isArray(q)) {
          // new questions: give them ids after the existing ones
          q.forEach((x: any) => {
            const id = Math.max(0, ...state.questions) + 1;
            x.id = id;
            state.marks[id] = x.mark ?? 1;
            state.questions.push(id);
          });
          return q;
        }
        state.quiz = { ...state.quiz, ...q };
        return q;
      },
    };
    return { manager, done: () => release && release() };
  };

  const transaction = async (fn: any) => {
    const { manager, done } = makeManager();
    try {
      return await fn(manager);
    } finally {
      done();
    }
  };

  const quizRepo: any = {
    findOne: jest.fn(async () => state.quiz), // used by verifyingInstractors
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => x),
    manager: { transaction },
  };
  const questionRepo: any = {
    create: jest.fn((x) => x),
    findOne: jest.fn(async (o: any) => ({ id: o.where.id, quiz: { id: 10, isPublished: state.quiz.isPublished } })),
    manager: { transaction },
  };
  return { state, quizRepo, questionRepo, QuestionEntity };
}
