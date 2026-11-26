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
  res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  next();
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
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
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
