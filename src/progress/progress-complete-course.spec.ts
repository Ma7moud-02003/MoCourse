import { Logger } from '@nestjs/common';
import { ProgressService } from './progress.service';

const make = (updateEnrollStatus: jest.Mock) => {
  const progress: any = { lastPosition: 0, completed: false, completedAt: null };
  const progressRepo: any = { findOne: jest.fn().mockResolvedValue(progress), save: jest.fn(async (p) => p) };
  const lessonService: any = {
    verifyStudentEnrollment: jest.fn().mockResolvedValue(true),
    getLessonSectionId: jest.fn().mockResolvedValue(1),
    getLessonForDeveopment: jest.fn().mockResolvedValue({ duration: 100, section: { id: 1 } }),
  };
  const sectionService: any = { getSection: jest.fn().mockResolvedValue({ course: { id: 7 } }) };
  const svc = new ProgressService(progressRepo, lessonService, sectionService, { updateEnrollStatus } as any);
  jest.spyOn(svc, 'getCourseProgress').mockResolvedValue({ persentage: 100 } as any);
  return { svc, progress, progressRepo };
};

describe('ProgressService.updateProgress course completion', () => {
  beforeEach(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('waits for the completion before answering', async () => {
    let done = false;
    const upd = jest.fn(async () => { await new Promise((r) => setTimeout(r, 20)); done = true; });
    const { svc } = make(upd);
    await svc.updateProgress({ lessonId: 1, lastPosition: 95 } as any, 5);
    expect(upd).toHaveBeenCalledWith(7, 5);
    expect(done).toBe(true);
  });

  it('keeps the saved progress and answers normally when completing fails, and logs it', async () => {
    const upd = jest.fn().mockRejectedValue(new Error('certificate table broken'));
    const { svc, progress, progressRepo } = make(upd);
    const res = await svc.updateProgress({ lessonId: 1, lastPosition: 95 } as any, 5);
    expect(res).toBe(progress);
    expect(progress.completed).toBe(true);
    expect(progressRepo.save).toHaveBeenCalled();
    expect(Logger.prototype.error).toHaveBeenCalled();
  });

  it('does not try to complete the course below 90%', async () => {
    const upd = jest.fn();
    const { svc } = make(upd);
    jest.spyOn(svc, 'getCourseProgress').mockResolvedValue({ persentage: 50 } as any);
    await svc.updateProgress({ lessonId: 1, lastPosition: 95 } as any, 5);
    expect(upd).not.toHaveBeenCalled();
  });
});
