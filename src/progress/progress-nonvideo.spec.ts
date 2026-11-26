import { BadRequestException } from '@nestjs/common';
import { ProgressService } from './progress.service';

const make = (lesson: any, courseProgress = 100) => {
  const progress: any = { lastPosition: 0, completed: false, completedAt: null };
  const progressRepo: any = { findOne: jest.fn().mockResolvedValue(progress), save: jest.fn(async (p) => p) };
  const lessonService: any = {
    verifyStudentEnrollment: jest.fn().mockResolvedValue(true),
    getLessonSectionId: jest.fn().mockResolvedValue(1),
    getLessonForDeveopment: jest.fn().mockResolvedValue({ section: { id: 1 }, ...lesson }),
  };
  const sectionService: any = { getSection: jest.fn().mockResolvedValue({ course: { id: 7 } }) };
  const updateEnrollStatus = jest.fn();
  const svc = new ProgressService(progressRepo, lessonService, sectionService, { updateEnrollStatus } as any);
  jest.spyOn(svc, 'getCourseProgress').mockResolvedValue({ persentage: courseProgress } as any);
  return { svc, progress, progressRepo, updateEnrollStatus };
};

describe('ProgressService.updateProgress for lessons without a duration', () => {
  it.each(['pdf', 'text'])('saves the position of a %s lesson without completing it', async (type) => {
    const { svc, progress } = make({ type, duration: null });
    const res: any = await svc.updateProgress({ lessonId: 1, lastPosition: 3 } as any, 5);
    expect(res.lastPosition).toBe(3);
    expect(progress.completed).toBe(false);
  });

  it.each(['pdf', 'text'])('completes a %s lesson when the student sends completed: true', async (type) => {
    const { svc, progress, updateEnrollStatus } = make({ type, duration: null });
    await svc.updateProgress({ lessonId: 1, lastPosition: 0, completed: true } as any, 5);
    expect(progress.completed).toBe(true);
    expect(progress.completedAt).toBeInstanceOf(Date);
    expect(updateEnrollStatus).toHaveBeenCalledWith(7, 5);
  });

  it('does not complete the course while other lessons are unfinished', async () => {
    const { svc, updateEnrollStatus } = make({ type: 'pdf', duration: null }, 40);
    await svc.updateProgress({ lessonId: 1, lastPosition: 0, completed: true } as any, 5);
    expect(updateEnrollStatus).not.toHaveBeenCalled();
  });

  it('never saves a negative position for a pdf lesson', async () => {
    const { svc } = make({ type: 'pdf', duration: null });
    const res: any = await svc.updateProgress({ lessonId: 1, lastPosition: -4 } as any, 5);
    expect(res.lastPosition).toBe(0);
  });

  it('keeps completed lessons completed when saved again without the flag', async () => {
    const { svc, progress } = make({ type: 'text', duration: null });
    progress.completed = true;
    await svc.updateProgress({ lessonId: 1, lastPosition: 2 } as any, 5);
    expect(progress.completed).toBe(true);
  });
});

describe('ProgressService.updateProgress keeps the video rules', () => {
  it('still rejects a video lesson with no duration', async () => {
    const { svc } = make({ type: 'video', duration: null });
    await expect(svc.updateProgress({ lessonId: 1, lastPosition: 10 } as any, 5)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('completes a video at 90% and clamps the position to its length', async () => {
    const { svc, progress } = make({ type: 'video', duration: 100 });
    await svc.updateProgress({ lessonId: 1, lastPosition: 500 } as any, 5);
    expect(progress.lastPosition).toBe(100);
    expect(progress.completed).toBe(true);
  });

  it('does not let completed: true finish a video that was not watched', async () => {
    const { svc, progress } = make({ type: 'video', duration: 100 });
    await svc.updateProgress({ lessonId: 1, lastPosition: 10, completed: true } as any, 5);
    expect(progress.completed).toBe(false);
    expect(progress.lastPosition).toBe(10);
  });
});
