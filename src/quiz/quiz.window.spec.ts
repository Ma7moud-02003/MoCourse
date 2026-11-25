import { BadRequestException, ConflictException } from '@nestjs/common';
import { QuizService } from './quiz.service';
import { fakeExamDb } from './exam-fake-db-spec';
import { checkWindow, parseInstant, windowMinutes } from './exam-window';

function build(opts: { published?: boolean; questionIds?: number[]; attempts?: number } = {}) {
  const db = fakeExamDb({ published: false, questionIds: [1], ...opts });
  const courseService: any = {
    getCourseDetails: jest.fn().mockResolvedValue({ id: 5 }),
    verifyingInstractorOwnTheCourse: jest.fn().mockResolvedValue(true),
  };
  return { service: new QuizService(db.quizRepo, db.questionRepo, courseService, {} as any), ...db };
}
const dto: any = { title: 'Quiz', courseId: 5, passMark: 60, quizTarget: 'course', opensAt: '2099-01-01T09:00:00+02:00', closesAt: '2099-01-01T10:00:00+02:00' };

describe('exam window', () => {
  it('parses offsets into the right UTC instant', () => {
    expect(parseInstant('2099-01-01T09:00:00+02:00', 'x').toISOString()).toBe('2099-01-01T07:00:00.000Z');
    expect(parseInstant('2099-01-01T07:00:00Z', 'x').toISOString()).toBe('2099-01-01T07:00:00.000Z');
  });
  it('rejects a date-time without an offset, a date only, and garbage', () => {
    for (const v of ['2099-01-01T09:00:00', '2099-01-01', 'soon', undefined, 5]) expect(() => parseInstant(v, 'x')).toThrow(BadRequestException);
  });
  it('closing must be after opening and in the future', () => {
    const t = (s: string) => new Date(s);
    expect(() => checkWindow(t('2099-01-01T10:00:00Z'), t('2099-01-01T10:00:00Z'))).toThrow(BadRequestException);
    expect(() => checkWindow(t('2099-01-01T11:00:00Z'), t('2099-01-01T10:00:00Z'))).toThrow(BadRequestException);
    expect(() => checkWindow(t('2000-01-01T10:00:00Z'), t('2000-01-01T11:00:00Z'))).toThrow(BadRequestException);
    expect(() => checkWindow(t('2099-01-01T10:00:00Z'), t('2099-01-01T11:00:00Z'))).not.toThrow();
  });
  it('window length in minutes', () => {
    expect(windowMinutes(new Date('2099-01-01T09:00:00Z'), new Date('2099-01-01T10:00:00Z'))).toBe(60);
  });

  it('create stores the window as UTC and defaults timeLimit to the window length', async () => {
    const { service, quizRepo } = build();
    await service.creatNewQuiz(3, dto);
    const saved = quizRepo.save.mock.calls[0][0];
    expect(saved.opensAt.toISOString()).toBe('2099-01-01T07:00:00.000Z');
    expect(saved.closesAt.toISOString()).toBe('2099-01-01T08:00:00.000Z');
    expect(saved.timeLimit).toBe(60);
  });
  it('create without a window, or with a bad one, saves nothing', async () => {
    const { service, quizRepo } = build();
    await expect(service.creatNewQuiz(3, { ...dto, opensAt: undefined })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.creatNewQuiz(3, { ...dto, closesAt: '2099-01-01T08:00:00+02:00' })).rejects.toBeInstanceOf(BadRequestException);
    expect(quizRepo.save).not.toHaveBeenCalled();
  });

  it('update changes the window before any attempt, and validates it against the stored other end', async () => {
    const { service, state } = build();
    await service.updateQuiz(10, 3, { closesAt: '2099-01-01T12:00:00Z' } as any);
    expect(state.quiz.closesAt.toISOString()).toBe('2099-01-01T12:00:00.000Z');
    await expect(service.updateQuiz(10, 3, { opensAt: '2099-01-01T13:00:00Z' } as any)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('the window is frozen once any attempt exists', async () => {
    const { service, state } = build({ attempts: 1 });
    await expect(service.updateQuiz(10, 3, { closesAt: '2099-01-01T12:00:00Z' } as any)).rejects.toBeInstanceOf(ConflictException);
    expect(state.quiz.closesAt.toISOString()).toBe('2099-01-01T08:00:00.000Z');
  });
  it('an exam without a window cannot be published', async () => {
    const { service, state } = build();
    state.quiz.opensAt = null;
    state.quiz.closesAt = null;
    await expect(service.updateQuiz(10, 3, { isPublished: true } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(state.quiz.isPublished).toBe(false);
    await service.updateQuiz(10, 3, { opensAt: '2099-01-01T07:00:00Z', closesAt: '2099-01-01T08:00:00Z', isPublished: true } as any);
    expect(state.quiz.isPublished).toBe(true);
  });
});
