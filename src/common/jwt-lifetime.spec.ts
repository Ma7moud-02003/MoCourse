import { JwtService } from '@nestjs/jwt';
import { jwtOptions } from './common.module';
import { JWT_LIFETIME_SECONDS } from 'src/utils/constants';

describe('login token lifetime', () => {
  it('is two hours (7200 seconds)', () => {
    expect(JWT_LIFETIME_SECONDS).toBe(7200);
  });

  it.each([undefined, '3600', '1h', '5', ''])('does not depend on JWT_EXPIREDIN=%p', async (env) => {
    const opts = jwtOptions({ get: (k: string) => (k === 'JWT_EXPIREDIN' ? env : 'secret') } as any);
    expect(opts.signOptions.expiresIn).toBe(7200);
    const jwt = new JwtService({ secret: opts.secret, signOptions: opts.signOptions });
    const payload: any = jwt.decode(await jwt.signAsync({ id: 1, role: 'student' }));
    expect(payload.exp - payload.iat).toBe(7200);
  });

  it('a token is still valid right after it is issued', async () => {
    const opts = jwtOptions({ get: () => 'secret' } as any);
    const jwt = new JwtService({ secret: opts.secret, signOptions: opts.signOptions });
    await expect(jwt.verifyAsync(await jwt.signAsync({ id: 1 }))).resolves.toMatchObject({ id: 1 });
  });
});
