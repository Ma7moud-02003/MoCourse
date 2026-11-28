import { NextFunction, Request, Response } from 'express';

/** Default frontend origin when CORS_ORIGIN is not set (the Angular dev server). */
export const DEFAULT_CORS_ORIGIN = 'http://localhost:4200';

/**
 * CORS_ORIGIN can hold one origin or several separated by commas,
 * e.g. CORS_ORIGIN=https://mocourse.com,https://www.mocourse.com
 * Missing or empty falls back to the local Angular dev server.
 */
export function parseCorsOrigins(value?: string): string[] {
  const list = (value ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return list.length ? list : [DEFAULT_CORS_ORIGIN];
}

/** A small set of safe response headers (the basics helmet adds), with no extra dependency. */
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.removeHeader('X-Powered-By');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  // this server only returns JSON/files: nothing may be framed, scripted or cached by a browser or shared proxy
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  next();
}

/**
 * Real visitor address. Behind Vercel the socket address is Vercel's own proxy, so counting it would put every
 * visitor in one bucket (one attacker could lock everybody out). Vercel sets these headers itself and replaces any
 * value the visitor sends. Locally (no proxy header) the socket address is used.
 */
export function clientIp(req: Request): string {
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.split(',')[0]?.trim();
  return (
    pick(req.headers?.['x-vercel-forwarded-for']) ||
    pick(req.headers?.['x-real-ip']) ||
    req.ip ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

/**
 * Simple in-memory rate limiter: at most `max` requests per `windowMs` for each client IP.
 * Good enough for one server instance; use a shared store if the API is ever scaled to several.
 */
export function createRateLimiter(max: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    if (hits.size > 5000) {
      for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
    }
    const key = clientIp(req);
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      res.status(429).json({
        statusCode: 429,
        message: 'Too many attempts, please try again in a few minutes',
      });
      return;
    }
    next();
  };
}
