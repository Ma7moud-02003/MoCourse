import { CourseService } from './course.service';

function build(opts: { ownerId: number; quizzes: any[] }) {
  const courseRepo: any = {
    findOne: jest.fn(async () => ({
      id: 5,
      Instractor: { id: opts.ownerId },
      quizzes: opts.quizzes,
    })),
  };
  const enroll: any = { verifyStudentEnrollment: jest.fn().mockResolvedValue(true) };
  const service = new CourseService(courseRepo, {} as any, enroll);
  // owner check reads the course through getSingleCourse; stub it to the same owner
  (service as any).getSingleCourse = jest.fn(async () => ({ Instractor: { id: opts.ownerId } }));
  return { service, courseRepo };
}

const quizzes = [
  { id: 1, title: 'Live', isPublished: true },
  { id: 2, title: 'Draft', isPublished: false },
];

describe('CourseService.getCourseDetails quizzes', () => {
  it('hides draft quizzes from a student', async () => {
    const { service } = build({ ownerId: 3, quizzes });
    const res: any = await service.getCourseDetails(5, 7);
    expect(res.quizzes.map((q: any) => q.id)).toEqual([1]);
  });

  it('hides draft quizzes when there is no user', async () => {
    const { service } = build({ ownerId: 3, quizzes });
    const res: any = await service.getCourseDetails(5);
    expect(res.quizzes.map((q: any) => q.id)).toEqual([1]);
  });

  it('shows drafts to the course owner', async () => {
    const { service } = build({ ownerId: 3, quizzes });
    const res: any = await service.getCourseDetails(5, 3);
    expect(res.quizzes.map((q: any) => q.id)).toEqual([1, 2]);
  });

  it('requests isPublished in the quiz select so the filter can work', async () => {
    const { service, courseRepo } = build({ ownerId: 3, quizzes });
    await service.getCourseDetails(5, 7);
    expect(courseRepo.findOne.mock.calls[0][0].select.quizzes.isPublished).toBe(true);
  });
});
