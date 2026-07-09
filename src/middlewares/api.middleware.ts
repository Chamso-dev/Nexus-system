/**
 * Express middlewares: request logging + latency, bearer auth, webhook-signature
 * verification, rate limiting, and a centralized error handler.
 */
import { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';
import { env } from '../config/env';
import { createLogger } from '../utils/logger';
import { metrics } from '../services/metrics.service';
import { rateLimit } from '../utils/cooldown';
import { AppError, isAppError } from '../utils/errors';

const log = createLogger('API');

/** Log each request and record its latency. */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    metrics.recordApiLatency(ms);
    log.http?.(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
}

/** Require a valid `Authorization: Bearer <API_AUTH_TOKEN>` header. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || token !== env.API_AUTH_TOKEN) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

/**
 * Verify an inbound webhook's HMAC signature (header `x-nexus-signature`).
 * Uses a timing-safe comparison against HMAC-SHA256(body, WEBHOOK_SECRET).
 */
export function verifyWebhook(req: Request, res: Response, next: NextFunction): void {
  const signature = req.header('x-nexus-signature') ?? '';
  const payload = JSON.stringify(req.body ?? {});
  const expected = crypto.createHmac('sha256', env.WEBHOOK_SECRET).update(payload).digest('hex');
  const ok =
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!ok) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }
  next();
}

/** Simple IP-based rate limiter for public endpoints. */
export function apiRateLimit(limit = 60, windowSeconds = 60) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip ?? 'unknown';
    const { allowed, remaining } = await rateLimit('api', ip, limit, windowSeconds);
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, remaining)));
    if (!allowed) {
      res.status(429).json({ error: 'Too many requests' });
      return;
    }
    next();
  };
}

/** Centralized error handler — must be registered last. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (isAppError(err)) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }
  const error = err as AppError;
  log.error('Unhandled API error', { message: error?.message, stack: error?.stack });
  res.status(500).json({ error: 'Internal server error' });
}
