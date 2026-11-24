import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { QuestionService } from './question.service';

function build(opts: { published: boolean; count: number; owns?: boolean; found?: boolean }) {
  const question: any = { id: 1, quiz: { id: 10, isPublished: opts.published } };
  const repo: any = {
    findOne: jest.fn(async () => (opts.found === false ? null : question)),
    count: jest.fn(async () => opts.count),
    remove: jest.fn(async (q) => q),
  };
  const quizService: any = { verifyingInstractors: jest.fn().mockResolvedValue(opts.owns ?? true) };
  const service = new QuestionService(repo, {} as any, quizService);
  return { service, repo };
}

describe('QuestionService.deleteQuestions', () => {
  it('blocks deleting the last question of a published exam', async () => {
    const { service, repo } = build({ published: true, count: 1 });
    await expect(service.deleteQuestions(1, 3)).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it('allows deleting a question of a published exam when others remain', async () => {
    const { service, repo } = build({ published: true, count: 2 });
    await service.deleteQuestions(1, 3);
    expect(repo.remove).toHaveBeenCalled();
  });

  it('allows deleting the last question of a draft exam', async () => {
    const { service, repo } = build({ published: false, count: 1 });
    await service.deleteQuestions(1, 3);
    expect(repo.remove).toHaveBeenCalled();
    expect(repo.count).not.toHaveBeenCalled();
  });

  it('still rejects a non-owner before anything else', async () => {
    const { service, repo } = build({ published: true, count: 1, owns: false });
    await expect(service.deleteQuestions(1, 9)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it('returns not found for a missing question', async () => {
    const { service } = build({ published: true, count: 1, found: false });
    await expect(service.deleteQuestions(1, 3)).rejects.toBeInstanceOf(NotFoundException);
  });
});
