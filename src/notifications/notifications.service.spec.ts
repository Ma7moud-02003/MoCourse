import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

const make = () => {
  const qb: any = { update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), execute: jest.fn().mockResolvedValue({ affected: 3 }) };
  const repo: any = { findAndCount: jest.fn(), count: jest.fn(), findOne: jest.fn(), save: jest.fn(async (x) => x), create: jest.fn((x) => x), createQueryBuilder: jest.fn(() => qb) };
  return { service: new NotificationsService(repo), repo, qb };
};

describe('NotificationsService', () => {
  it('lists only the caller rows, newest first, with pagination and no user data', async () => {
    const { service, repo } = make();
    repo.findAndCount.mockResolvedValue([[{ id: 2, title: 't', message: 'm', type: 'system', isRead: false, resourceId: null, createdAt: new Date(), user: { id: 5, email: 'a@b.c' } }], 45]);
    const res: any = await service.getMyNotitfications(5, 2, 20);
    expect(repo.findAndCount.mock.calls[0][0]).toMatchObject({ where: { user: { id: 5 } }, order: { createdAt: 'DESC', id: 'DESC' }, take: 20, skip: 20 });
    expect(res).toMatchObject({ page: 2, limit: 20, total: 45, totalPages: 3 });
    expect(JSON.stringify(res)).not.toMatch(/a@b\.c|"user"/);
  });
  it('caps page size at 50 and fixes bad page numbers', async () => {
    const { service, repo } = make();
    repo.findAndCount.mockResolvedValue([[], 0]);
    await service.getMyNotitfications(5, -4, 9999);
    expect(repo.findAndCount.mock.calls[0][0]).toMatchObject({ take: 50, skip: 0 });
  });
  it('counts unread for the caller only', async () => {
    const { service, repo } = make();
    repo.count.mockResolvedValue(4);
    expect(await service.getUnreadCount(5)).toEqual({ unreadCount: 4 });
    expect(repo.count.mock.calls[0][0]).toEqual({ where: { user: { id: 5 }, isRead: false } });
  });
  it('marks one read only when it belongs to the caller', async () => {
    const { service, repo } = make();
    repo.findOne.mockResolvedValue(null);
    await expect(service.markAsRead(9, 5)).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.findOne.mock.calls[0][0]).toEqual({ where: { id: 9, user: { id: 5 } } });
    expect(repo.save).not.toHaveBeenCalled();
  });
  it('mark all read is scoped to the caller id', async () => {
    const { service, qb } = make();
    expect(await service.markAllAsRead(5)).toEqual({ updated: 3 });
    expect(qb.where.mock.calls[0][1]).toEqual({ userId: 5 });
  });
});
