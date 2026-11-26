import { UserService } from './user.service';
import { UserRoles } from 'src/utils/enums/userRole.enum';

function setup() {
  const repo: any = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((x) => ({ id: 1, ...x })),
    save: jest.fn(async (x) => x),
  };
  const jwt: any = { signAsync: jest.fn().mockResolvedValue('token') };
  return { svc: new UserService(repo, jwt, {} as any, {} as any), repo };
}
const dto = (role?: any): any => ({ fullName: 'A', email: 'a@a.com', password: 'secret123', role });

describe('public register role', () => {
  it('never creates an admin from the request body', async () => {
    const { svc, repo } = setup();
    await svc.register(dto(UserRoles.ADMIN));
    expect(repo.create.mock.calls[0][0].role).toBe(UserRoles.STUDENT);
  });
  it('ignores unknown roles and a missing role (student)', async () => {
    for (const r of ['superuser', undefined, null]) {
      const { svc, repo } = setup();
      await svc.register(dto(r));
      expect(repo.create.mock.calls[0][0].role).toBe(UserRoles.STUDENT);
    }
  });
  it('keeps the existing contract: student and instructor roles are accepted', async () => {
    const a = setup();
    await a.svc.register(dto(UserRoles.INSTRACTOR));
    expect(a.repo.create.mock.calls[0][0].role).toBe(UserRoles.INSTRACTOR);
    const b = setup();
    await b.svc.register(dto(UserRoles.STUDENT));
    expect(b.repo.create.mock.calls[0][0].role).toBe(UserRoles.STUDENT);
  });
});

import { ConflictException, NotFoundException } from '@nestjs/common';
describe('deleteUser guard', () => {
  function withManager(user: any, attempts: number) {
    const m: any = {
      findOne: jest.fn(async () => user),
      count: jest.fn(async () => attempts),
      delete: jest.fn(async () => ({ affected: 1 })),
    };
    const repo: any = { manager: { transaction: async (fn: any) => fn(m) } };
    return { svc: new UserService(repo, {} as any, {} as any, {} as any), m };
  }
  it('locks the user row, then refuses when the account has attempts, deleting nothing', async () => {
    const { svc, m } = withManager({ id: 4 }, 2);
    await expect(svc.deleteUser(4)).rejects.toBeInstanceOf(ConflictException);
    expect(m.findOne.mock.calls[0][1].lock).toEqual({ mode: 'pessimistic_write' });
    expect(m.delete).not.toHaveBeenCalled();
  });
  it('deletes an account with no attempts', async () => {
    const { svc, m } = withManager({ id: 4 }, 0);
    await expect(svc.deleteUser(4)).resolves.toEqual({ message: 'User Deleted Successfully' });
    expect(m.delete).toHaveBeenCalled();
  });
  it('unknown user -> 404', async () => {
    const { svc } = withManager(null, 0);
    await expect(svc.deleteUser(4)).rejects.toBeInstanceOf(NotFoundException);
  });
});
