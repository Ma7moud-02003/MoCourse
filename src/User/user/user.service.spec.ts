import { UserService } from './user.service';
import { UserRoles } from 'src/utils/enums/userRole.enum';

function setup() {
  const repo: any = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((x) => ({ id: 1, ...x })),
    save: jest.fn(async (x) => x),
  };
  const jwt: any = { signAsync: jest.fn().mockResolvedValue('token') };
  return { svc: new UserService(repo, jwt, {} as any), repo };
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
