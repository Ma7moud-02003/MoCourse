import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { QuizAttemptService } from './quiz-attempt.service';
import { QuizAttemptEntity } from './quiz-attemp.entity';
import { QuizEntity } from 'src/quiz/quiz.entity';
import { QuestionEntity } from 'src/question/question.entity';

const future = new Date(Date.now() + 3600e3);
function build(o: { shuffleQuestions?: boolean; shuffleChoices?: boolean; attempt?: any; ownerId?: number } = {}) {
  const questions = [1, 2, 3, 4, 5, 6].map((i) => ({ id: i, question: 'Q' + i, type: 'mcq', mark: 1, order: i, choices: [1, 2, 3, 4].map((k) => ({ id: i * 10 + k, text: 'c' + k, order: k, isCorrect: k === 1 })) }));
  const attempt = { id: 9, user: 7, quiz: 10, submitted: false, expiresAt: future, ...(o.attempt ?? {}) };
  const manager: any = {
    findOne: jest.fn(async (e: any) => (e === QuizAttemptEntity ? attempt : e === QuizEntity ? { id: 10, shuffleQuestions: !!o.shuffleQuestions, shuffleChoices: !!o.shuffleChoices } : null)),
    find: jest.fn(async (e: any) => (e === QuestionEntity ? [...questions].reverse() : [])),
  };
  const quizRepo: any = { findOne: jest.fn(async () => ({ id: 10, passMark: 50, course: { Instractor: { id: o.ownerId ?? 3 } } })) };
  return new QuizAttemptService({ manager } as any, quizRepo, {} as any);
}

describe('QuizAttemptService.getQuestions', () => {
  it('never exposes which choice is correct (explicit fields only)', async () => {
    const res: any = await build().getQuestions(9, 7);
    expect(JSON.stringify(res)).not.toMatch(/isCorrect|correct/i);
    expect(Object.keys(res.questions[0]).sort()).toEqual(['choices', 'id', 'mark', 'question', 'type']);
    expect(Object.keys(res.questions[0].choices[0]).sort()).toEqual(['id', 'text']);
  });
  it('without shuffle: teacher order (order, then id)', async () => {
    const res: any = await build().getQuestions(9, 7);
    expect(res.questions.map((q: any) => q.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(res.questions[0].choices.map((c: any) => c.id)).toEqual([11, 12, 13, 14]);
  });
  it('with shuffle: same order on every call (resume), different from the teacher order', async () => {
    const svc = build({ shuffleQuestions: true, shuffleChoices: true });
    const a: any = await svc.getQuestions(9, 7);
    const b: any = await svc.getQuestions(9, 7);
    expect(b.questions.map((q: any) => [q.id, q.choices.map((c: any) => c.id)])).toEqual(a.questions.map((q: any) => [q.id, q.choices.map((c: any) => c.id)]));
    expect(a.questions.map((q: any) => q.id)).not.toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("another student's attempt -> 404; submitted or expired -> 409", async () => {
    await expect(build().getQuestions(9, 8)).rejects.toBeInstanceOf(NotFoundException);
    await expect(build({ attempt: { submitted: true } }).getQuestions(9, 7)).rejects.toBeInstanceOf(ConflictException);
    await expect(build({ attempt: { expiresAt: new Date(Date.now() - 1000) } }).getQuestions(9, 7)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('QuizAttemptService.getExamResults ownership', () => {
  it('only the owning instructor', async () => {
    await expect(build({ ownerId: 3 }).getExamResults(10, 99)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
