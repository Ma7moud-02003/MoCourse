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
    const res: any = await service.updateQuestion(3, 1, { choices: [{ id: 101 }] } as any);
    expect(res.choices[0]).toMatchObject({ text: 'B', order: 2 });
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
