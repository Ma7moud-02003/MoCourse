import { ConflictException, ForbiddenException } from '@nestjs/common';
import { QuizService } from './quiz.service';
import { fakeExamDb } from './exam-fake-db-spec';

function build(opts: { attempts?: number } = {}) {
  const db = fakeExamDb({ published: true, questionIds: [1], ...opts });
  const service = new QuizService(db.quizRepo, db.questionRepo, {} as any, {} as any);
  return { service, ...db };
}

describe('QuizService.deleteQuize protects student results', () => {
  it('deletes an exam nobody attempted', async () => {
    const { service, state } = build({ attempts: 0 });
    await service.deleteQuize(10, 3);
    expect(state.deleted).toBe(true);
  });

  it('refuses (409) once any attempt exists and deletes nothing', async () => {
    const { service, state } = build({ attempts: 1 });
    await expect(service.deleteQuize(10, 3)).rejects.toBeInstanceOf(ConflictException);
    expect(state.deleted).toBe(false);
  });

  it('a non-owner is refused before anything else', async () => {
    const { service, state } = build({ attempts: 0 });
    await expect(service.deleteQuize(10, 99)).rejects.toBeInstanceOf(ForbiddenException);
    expect(state.deleted).toBe(false);
  });

  it('takes the exclusive row lock so a start cannot slip in between the check and the delete', async () => {
    const { service, quizRepo } = build();
    const seen: any[] = [];
    const orig = quizRepo.manager.transaction;
    quizRepo.manager.transaction = (fn: any) => orig((m: any) => { const f = m.findOne; m.findOne = (e: any, o: any) => { seen.push(o?.lock?.mode); return f(e, o); }; return fn(m); });
    await service.deleteQuize(10, 3);
    expect(seen).toContain('pessimistic_write');
  });
});
