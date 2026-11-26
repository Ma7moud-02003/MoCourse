import { OptionalAuthGuard } from './optional-auth.guard';

const run = async (header: string | undefined, verify: jest.Mock) => {
  const guard = new OptionalAuthGuard({ verifyAsync: verify } as any, { get: () => 's' } as any);
  const req: any = { headers: header ? { authorization: header } : {} };
  const ok = await guard.canActivate({ switchToHttp: () => ({ getRequest: () => req }) } as any);
  return { ok, req };
};

describe('OptionalAuthGuard', () => {
  it('sets user for a valid token', async () => {
    const { ok, req } = await run('Bearer t', jest.fn().mockResolvedValue({ id: 3, role: 'admin' }));
    expect(ok).toBe(true); expect(req.user).toEqual({ id: 3, role: 'admin' });
  });
  it('stays anonymous with no token', async () => {
    const v = jest.fn(); const { ok, req } = await run(undefined, v);
    expect(ok).toBe(true); expect(req.user).toBeUndefined(); expect(v).not.toHaveBeenCalled();
  });
  it('stays anonymous (no 401) with a bad token', async () => {
    const { ok, req } = await run('Bearer bad', jest.fn().mockRejectedValue(new Error('x')));
    expect(ok).toBe(true); expect(req.user).toBeUndefined();
  });
});
