import { BadRequestException, ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ReviewService } from './review.service';
import { UserRoles } from 'src/utils/enums/userRole.enum';

const makeService = () => {
  const repo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(),
    remove: jest.fn(),
  };
  const courseService = { getSingleCourse: jest.fn() };
  const userService = { getUserRole: jest.fn() };
  const enrollmentService = { verifyStudentEnrollment: jest.fn() };
  const service = new ReviewService(repo as any, courseService as any, userService as any, enrollmentService as any);
  return { service, repo, courseService, userService, enrollmentService };
};

// enrolled student in course 1 whose instructor is user 99
const mockEnrolled = (m: ReturnType<typeof makeService>, userId = 10) => {
  m.courseService.getSingleCourse.mockResolvedValue({ id: 1, Instractor: { id: 99 } });
  m.userService.getUserRole.mockResolvedValue(UserRoles.STUDENT);
  m.enrollmentService.verifyStudentEnrollment.mockResolvedValue(true);
};

describe('ReviewService.addNewComment', () => {
  it('accepts a zero rating instead of rejecting it', async () => {
    const m = makeService();
    mockEnrolled(m);
    m.repo.save.mockResolvedValue({ id: 5, comment: 'great course', rateing: 0, createdAt: new Date() });
    const res: any = await m.service.addNewComment(1, 10, { comment: 'great course', rateing: 0 });
    expect(res.rateing).toBe(0);
    expect(m.repo.save).toHaveBeenCalledTimes(1);
  });

  it('rejects a missing rating with 400, not 502', async () => {
    const m = makeService();
    await expect(m.service.addNewComment(1, 10, { comment: 'great course' } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects students who are not enrolled', async () => {
    const m = makeService();
    mockEnrolled(m);
    m.enrollmentService.verifyStudentEnrollment.mockResolvedValue(false);
    await expect(m.service.addNewComment(1, 10, { comment: 'great course', rateing: 4 })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(m.repo.save).not.toHaveBeenCalled();
  });

  it('does not pass an injected id from the request body to the entity (no mass assignment)', async () => {
    const m = makeService();
    mockEnrolled(m);
    m.repo.save.mockResolvedValue({ id: 7, comment: 'nice', rateing: 5, createdAt: new Date() });
    await m.service.addNewComment(1, 10, { comment: 'nice', rateing: 5, id: 42 } as any);
    expect(m.repo.create).toHaveBeenCalledWith({ comment: 'nice', rateing: 5, user: { id: 10 }, course: { id: 1 } });
  });

  it('rejects a second review for the same student and course with 409', async () => {
    const m = makeService();
    mockEnrolled(m);
    m.repo.findOne.mockResolvedValue({ id: 3 });
    await expect(m.service.addNewComment(1, 10, { comment: 'second take', rateing: 2 })).rejects.toBeInstanceOf(ConflictException);
    expect(m.repo.save).not.toHaveBeenCalled();
  });

  it('treats a concurrent unique violation as 409, not a 500', async () => {
    const m = makeService();
    mockEnrolled(m);
    m.repo.findOne.mockResolvedValue(null);
    m.repo.save.mockRejectedValue(new QueryFailedError('INSERT', [], Object.assign(new Error('dup'), { code: '23505' })));
    await expect(m.service.addNewComment(1, 10, { comment: 'second take', rateing: 2 })).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('ReviewService.updateComment', () => {
  it('scopes the review lookup to the course in the URL', async () => {
    const m = makeService();
    mockEnrolled(m);
    m.repo.findOne.mockResolvedValue(null);
    await expect(m.service.updateComment(3, 1, 10, { comment: 'edited text' })).rejects.toBeInstanceOf(NotFoundException);
    expect(m.repo.findOne).toHaveBeenCalledWith({ where: { id: 3, course: { id: 1 } } });
  });

  it('rejects updating a review the student does not own', async () => {
    const m = makeService();
    mockEnrolled(m);
    m.repo.findOne
      .mockResolvedValueOnce({ id: 3, comment: 'old', rateing: 3 }) // review in course
      .mockResolvedValueOnce(null); // ownership check
    await expect(m.service.updateComment(3, 1, 10, { comment: 'edited text' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(m.repo.save).not.toHaveBeenCalled();
  });

  it('updates only the fields that were sent', async () => {
    const m = makeService();
    mockEnrolled(m);
    const review = { id: 3, comment: 'old comment', rateing: 3 };
    m.repo.findOne.mockResolvedValue(review);
    const res = await m.service.updateComment(3, 1, 10, { rateing: 5 });
    expect(res).toEqual({ message: 'Updated Successfully' });
    expect(review.comment).toBe('old comment');
    expect(review.rateing).toBe(5);
  });
});

describe('ReviewService.deleteReview', () => {
  const review = { id: 3, user: { id: 10 } };

  it('lets an admin delete any review', async () => {
    const m = makeService();
    m.repo.findOne.mockResolvedValue({ ...review });
    const res = await m.service.deleteReview(3, 1, { id: 1, role: UserRoles.ADMIN });
    expect(res).toEqual({ message: 'Removed Successfully' });
    expect(m.repo.remove).toHaveBeenCalledTimes(1);
  });

  it('lets the course instructor delete a review on their own course', async () => {
    const m = makeService();
    m.repo.findOne.mockResolvedValue({ ...review });
    m.courseService.getSingleCourse.mockResolvedValue({ id: 1, Instractor: { id: 99 } });
    const res = await m.service.deleteReview(3, 1, { id: 99, role: UserRoles.INSTRACTOR });
    expect(res).toEqual({ message: 'Removed Successfully' });
  });

  it('rejects an instructor deleting a review on someone else\'s course', async () => {
    const m = makeService();
    m.repo.findOne.mockResolvedValue({ ...review });
    m.courseService.getSingleCourse.mockResolvedValue({ id: 1, Instractor: { id: 99 } });
    await expect(m.service.deleteReview(3, 1, { id: 55, role: UserRoles.INSTRACTOR })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(m.repo.remove).not.toHaveBeenCalled();
  });

  it('lets the review author delete their own review', async () => {
    const m = makeService();
    m.repo.findOne.mockResolvedValue({ ...review });
    m.courseService.getSingleCourse.mockResolvedValue({ id: 1, Instractor: { id: 99 } });
    const res = await m.service.deleteReview(3, 1, { id: 10, role: UserRoles.STUDENT });
    expect(res).toEqual({ message: 'Removed Successfully' });
  });

  it('rejects a student deleting someone else\'s review', async () => {
    const m = makeService();
    m.repo.findOne.mockResolvedValue({ ...review });
    m.courseService.getSingleCourse.mockResolvedValue({ id: 1, Instractor: { id: 99 } });
    await expect(m.service.deleteReview(3, 1, { id: 11, role: UserRoles.STUDENT })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(m.repo.remove).not.toHaveBeenCalled();
  });

  it('scopes the review lookup to the course in the URL', async () => {
    const m = makeService();
    m.repo.findOne.mockResolvedValue(null);
    await expect(m.service.deleteReview(3, 2, { id: 1, role: UserRoles.ADMIN })).rejects.toBeInstanceOf(NotFoundException);
    expect(m.repo.findOne).toHaveBeenCalledWith({
      where: { id: 3, course: { id: 2 } },
      relations: { user: true },
      select: { user: { id: true } },
    });
  });
});

describe('ReviewService.getCourseReviews (public)', () => {
  const row = (id: number) => ({
    id, comment: 'c' + id, rateing: 5, createdAt: new Date(), updatedAt: new Date(),
    user: { id: 77, email: 'secret@x.com', password: 'h', fullName: 'Sara', avatar: 'a.png' },
  });

  it('returns only public fields and never the reviewer id/email', async () => {
    const m = makeService();
    m.courseService.getSingleCourse.mockResolvedValue({ id: 1, isPublished: true });
    m.repo.find.mockResolvedValue([row(1)]);
    const res: any = await m.service.getCourseReviews(1);
    expect(res[0].user).toEqual({ fullName: 'Sara', avatar: 'a.png' });
    expect(JSON.stringify(res)).not.toMatch(/secret@x\.com|"password"|77/);
  });

  it('404s for a draft course', async () => {
    const m = makeService();
    m.courseService.getSingleCourse.mockResolvedValue({ id: 1, isPublished: false });
    await expect(m.service.getCourseReviews(1)).rejects.toBeInstanceOf(NotFoundException);
    expect(m.repo.find).not.toHaveBeenCalled();
  });

  it('caps page size at 50 and pages correctly', async () => {
    const m = makeService();
    m.courseService.getSingleCourse.mockResolvedValue({ id: 1, isPublished: true });
    m.repo.find.mockResolvedValue([]);
    await m.service.getCourseReviews(1, 3, 9999);
    expect(m.repo.find.mock.calls[0][0]).toMatchObject({ take: 50, skip: 100 });
  });
});
