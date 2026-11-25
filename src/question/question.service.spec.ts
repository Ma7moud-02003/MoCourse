import { BadRequestException, ConflictException } from '@nestjs/common';
import { QuestionService } from './question.service';

function build() {
  const existing: any = {
    id: 1, question: 'Q', type: 'mcq', mark: 1, order: 1, quiz: { id: 10 },
    choices: [
      { id: 100, text: 'A', order: 1, isCorrect: true },
      { id: 101, text: 'B', order: 2, isCorrect: false },
    ],
  };
  const manager: any = {
    remove: jest.fn(),
    create: jest.fn((_e, x) => x),
    save: jest.fn(async (x) => x),
    findOne: jest.fn(async () => ({ id: 10 })),
    sum: jest.fn(async () => 7),
    count: jest.fn(async () => 0),
    update: jest.fn(),
  };
  const repo: any = {
    findOne: jest.fn().mockResolvedValue(existing),
    manager: { transaction: (fn: any) => fn(manager) },
  };
  const quizService: any = { verifyingInstractors: jest.fn().mockResolvedValue(true) };
  const service = new QuestionService(repo, {} as any, quizService);
  return { service, existing, manager, quizService };
}

describe('QuestionService.updateQuestion', () => {
  it('keeps isCorrect when the choice update omits it', async () => {
    const { service } = build();
    const res: any = await service.updateQuestion(3, 1, {
      choices: [{ id: 100, text: 'A edited' }, { id: 101 }],
    } as any);
    expect(res.choices[0]).toMatchObject({ id: 100, text: 'A edited', isCorrect: true });
    expect(res.choices[1]).toMatchObject({ id: 101, isCorrect: false });
  });

  it('still lets the instructor change isCorrect explicitly', async () => {
    const { service } = build();
    const res: any = await service.updateQuestion(3, 1, {
      choices: [{ id: 100, isCorrect: false }, { id: 101, isCorrect: true }],
    } as any);
    expect(res.choices[0].isCorrect).toBe(false);
    expect(res.choices[1].isCorrect).toBe(true);
  });

  it('keeps text and order when omitted', async () => {
    const { service } = build();
    const res: any = await service.updateQuestion(3, 1, { choices: [{ id: 100 }, { id: 101 }] } as any);
    expect(res.choices[1]).toMatchObject({ text: 'B', order: 2 });
  });

  it('rejects another instructor', async () => {
    const { service, quizService } = build();
    quizService.verifyingInstractors.mockResolvedValue(false);
    await expect(service.updateQuestion(9, 1, {} as any)).rejects.toThrow();
  });
});

describe('totalMarks follows the question marks', () => {
  it('recomputes totalMarks when a question mark changes', async () => {
    const { service, manager } = build();
    await service.updateQuestion(3, 1, { mark: 5 } as any);
    expect(manager.update).toHaveBeenCalledWith(expect.anything(), { id: 10 }, { totalMarks: 7 });
  });

  it('does not touch totalMarks when the mark is unchanged', async () => {
    const { service, manager } = build();
    await service.updateQuestion(3, 1, { question: 'new text' } as any);
    expect(manager.update).not.toHaveBeenCalled();
  });
});

describe('choice rules on update', () => {
  it('rejects removing the only correct choice', async () => {
    const { service, manager } = build();
    await expect(service.updateQuestion(3, 1, { choices: [{ id: 100, isCorrect: false }, { id: 101 }] } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects two correct choices', async () => {
    const { service } = build();
    await expect(service.updateQuestion(3, 1, { choices: [{ id: 100 }, { id: 101, isCorrect: true }] } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects dropping to one choice and removes nothing', async () => {
    const { service, manager } = build();
    await expect(service.updateQuestion(3, 1, { choices: [{ id: 100 }] } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.remove).not.toHaveBeenCalled();
  });

  it('rejects more than 6 choices on an mcq', async () => {
    const { service } = build();
    const many = [{ id: 100 }, { id: 101 }, ...[1, 2, 3, 4, 5].map((n) => ({ text: 'x' + n, order: n + 2, isCorrect: false }))];
    await expect(service.updateQuestion(3, 1, { choices: many } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts adding a new wrong choice (3 choices, one correct)', async () => {
    const { service } = build();
    const res: any = await service.updateQuestion(3, 1, { choices: [{ id: 100 }, { id: 101 }, { text: 'C', order: 3, isCorrect: false }] } as any);
    expect(res.choices).toHaveLength(3);
  });

  it('accepts changing type to true_false when the 2 choices fit', async () => {
    const { service } = build();
    const res: any = await service.updateQuestion(3, 1, { type: 'true_false' } as any);
    expect(res.type).toBe('true_false');
  });

  it('rejects changing type to true_false when it has 3 choices', async () => {
    const { service, existing } = build();
    existing.choices.push({ id: 102, text: 'C', order: 3, isCorrect: false });
    await expect(service.updateQuestion(3, 1, { type: 'true_false' } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a mark-only edit while the existing choices are invalid', async () => {
    const { service, existing, manager } = build();
    existing.choices.forEach((c: any) => (c.isCorrect = false)); // old bad data
    await expect(service.updateQuestion(3, 1, { mark: 4 } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects a text-only edit while the existing choices are invalid', async () => {
    const { service, existing } = build();
    existing.choices.forEach((c: any) => (c.isCorrect = false));
    await expect(service.updateQuestion(3, 1, { question: 'new' } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows fixing the choices together with the mark on an invalid question', async () => {
    const { service, existing } = build();
    existing.choices.forEach((c: any) => (c.isCorrect = false));
    const res: any = await service.updateQuestion(3, 1, { mark: 4, choices: [{ id: 100, isCorrect: true }, { id: 101 }] } as any);
    expect(res.mark).toBe(4);
  });

  it('a mark-only edit on a valid question still works', async () => {
    const { service } = build();
    const res: any = await service.updateQuestion(3, 1, { mark: 4 } as any);
    expect(res.mark).toBe(4);
  });
});

describe('update is blocked once a student started', () => {
  it('rejects any question update (mark, text, choices) when attempts exist', async () => {
    const { service, manager } = build();
    manager.count.mockResolvedValue(1);
    for (const dto of [{ mark: 5 }, { question: 'x' }, { choices: [{ id: 100 }, { id: 101 }] }]) {
      await expect(service.updateQuestion(3, 1, dto as any)).rejects.toBeInstanceOf(ConflictException);
    }
    expect(manager.save).not.toHaveBeenCalled();
    expect(manager.remove).not.toHaveBeenCalled();
  });

  it('locks the exam row before checking attempts', async () => {
    const { service, manager } = build();
    await service.updateQuestion(3, 1, { mark: 2 } as any);
    expect(manager.findOne.mock.calls[0][1].lock).toEqual({ mode: 'pessimistic_write' });
  });
});
