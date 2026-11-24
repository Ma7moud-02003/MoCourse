import { ForbiddenException } from '@nestjs/common';
import { LessonService } from './lesson.service';
import { LessonType } from 'src/utils/enums/lessonType.enum';

const OWNER = 9, OTHER = 77;

function setup() {
  const lessonRepo: any = {
    findOne: jest.fn().mockResolvedValue({ id: 1, type: LessonType.PDF, section: { id: 2 } }),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => x),
    remove: jest.fn(async (x) => x),
  };
  const sectionService: any = { getSection: jest.fn().mockResolvedValue({ id: 2, course: { id: 5 } }) };
  const courseService: any = { getSingleCourse: jest.fn().mockResolvedValue({ id: 5, Instractor: { id: OWNER } }) };
  const cloud: any = { uploadFile: jest.fn() };
  const svc = new LessonService(lessonRepo, sectionService, courseService, cloud, {} as any);
  return { svc, lessonRepo, cloud };
}

describe('lesson ownership', () => {
  const file: any = { mimetype: 'application/pdf', buffer: Buffer.from('x') };
  it('another instructor cannot add a lesson to the course', async () => {
    const { svc, lessonRepo } = setup();
    await expect(svc.addLesson({ title: 't', sectionId: 2, type: LessonType.PDF } as any, OTHER)).rejects.toThrow(ForbiddenException);
    expect(lessonRepo.save).not.toHaveBeenCalled();
  });
  it('another instructor cannot update a lesson', async () => {
    const { svc, lessonRepo } = setup();
    await expect(svc.updateLessone(1, { title: 'x' } as any, OTHER)).rejects.toThrow(ForbiddenException);
    expect(lessonRepo.save).not.toHaveBeenCalled();
  });
  it('another instructor cannot delete a lesson', async () => {
    const { svc, lessonRepo } = setup();
    await expect(svc.deleteLesson(1, OTHER)).rejects.toThrow(ForbiddenException);
    expect(lessonRepo.remove).not.toHaveBeenCalled();
  });
  it('another instructor cannot upload a file to a lesson', async () => {
    const { svc, cloud } = setup();
    await expect(svc.updateLesson_Upload(file, 1, OTHER)).rejects.toThrow(ForbiddenException);
    expect(cloud.uploadFile).not.toHaveBeenCalled();
  });
  it('the owner can add, update and delete', async () => {
    const { svc, lessonRepo } = setup();
    await svc.addLesson({ title: 't', sectionId: 2, type: LessonType.PDF } as any, OWNER);
    await svc.updateLessone(1, { title: 'x' } as any, OWNER);
    await svc.deleteLesson(1, OWNER);
    expect(lessonRepo.save).toHaveBeenCalledTimes(2);
    expect(lessonRepo.remove).toHaveBeenCalledTimes(1);
  });
});
