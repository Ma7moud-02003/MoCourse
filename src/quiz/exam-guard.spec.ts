import { ConflictException } from '@nestjs/common';
import { assertNoExamAttempts } from './exam-guard';

function mgr(exams: number[], attempts: number) {
  const calls: string[] = [];
  const m: any = {
    find: jest.fn(async (_e: any, o: any) => { calls.push(o.lock ? 'lock' : 'list'); return exams.map((id) => ({ id })); }),
    count: jest.fn(async () => { calls.push('count'); return attempts; }),
  };
  return { m, calls };
}

describe('assertNoExamAttempts (section / lesson delete)', () => {
  it('no exams: nothing locked', async () => {
    const { m, calls } = mgr([], 0);
    await assertNoExamAttempts(m, { lesson: { id: 1 } }, 'x');
    expect(calls).toEqual(['list']);
  });
  it('locks exclusively before counting, passes with no attempts', async () => {
    const { m, calls } = mgr([4, 5], 0);
    await assertNoExamAttempts(m, { lesson: { id: 1 } }, 'x');
    expect(calls).toEqual(['list', 'lock', 'count']);
  });
  it('409 when an attempt exists', async () => {
    const { m } = mgr([4], 1);
    await expect(assertNoExamAttempts(m, { lesson: { id: 1 } }, 'blocked')).rejects.toBeInstanceOf(ConflictException);
  });
});
