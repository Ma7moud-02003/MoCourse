import { createRateLimiter, DEFAULT_CORS_ORIGIN, parseCorsOrigins, securityHeaders } from './security';

function fakeRes() {
  const res: any = { headers: {} as Record<string, string>, statusCode: 200, body: undefined };
  res.setHeader = (k: string, v: string) => (res.headers[k] = v);
  res.removeHeader = jest.fn();
  res.status = (c: number) => ((res.statusCode = c), res);
  res.json = (b: unknown) => ((res.body = b), res);
  return res;
}

describe('parseCorsOrigins', () => {
  it('defaults to the local Angular dev server', () => {
    expect(parseCorsOrigins(undefined)).toEqual([DEFAULT_CORS_ORIGIN]);
    expect(parseCorsOrigins('  ')).toEqual([DEFAULT_CORS_ORIGIN]);
  });
  it('reads one or many origins and trims trailing slashes', () => {
    expect(parseCorsOrigins('https://a.com/, https://b.com')).toEqual(['https://a.com', 'https://b.com']);
  });
});

describe('securityHeaders', () => {
  it('sets safe headers and calls next', () => {
    const res = fakeRes();
    const next = jest.fn();
    securityHeaders({} as any, res, next);
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(res.removeHeader).toHaveBeenCalledWith('X-Powered-By');
    expect(next).toHaveBeenCalled();
  });
});

describe('createRateLimiter', () => {
  it('allows `max` requests then answers 429 with Retry-After', () => {
    const limiter = createRateLimiter(2, 60_000);
    const req: any = { ip: '1.2.3.4' };
    const next = jest.fn();
    limiter(req, fakeRes(), next);
    limiter(req, fakeRes(), next);
    const blocked = fakeRes();
    limiter(req, blocked, next);
    expect(next).toHaveBeenCalledTimes(2);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['Retry-After']).toBeDefined();
  });
  it('counts each IP separately', () => {
    const limiter = createRateLimiter(1, 60_000);
    const next = jest.fn();
    limiter({ ip: 'a' } as any, fakeRes(), next);
    limiter({ ip: 'b' } as any, fakeRes(), next);
    expect(next).toHaveBeenCalledTimes(2);
  });
});
