/**
 * Redis connection wrapper.
 *
 * Redis is used for caching, cooldowns and rate limiting. The bot must remain
 * functional if Redis is briefly unavailable, so we:
 *  - lazily connect,
 *  - never throw on connection errors (they are logged and retried),
 *  - expose a `isReady()` probe so callers can fall back to in-memory logic.
 */
import Redis from 'ioredis';
import { env } from '../config/env';
import { createLogger } from '../utils/logger';

const log = createLogger('Redis');

/** Singleton ioredis client with sane retry/backoff. */
export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 2,
  enableReadyCheck: true,
  retryStrategy: (times) => {
    // Exponential backoff capped at 10s.
    const delay = Math.min(times * 200, 10_000);
    return delay;
  },
});

let ready = false;

redis.on('ready', () => {
  ready = true;
  log.info('Redis connection ready');
});
redis.on('error', (err) => {
  ready = false;
  log.error('Redis error', { message: err.message });
});
redis.on('close', () => {
  ready = false;
});

/** Attempt to establish the connection (idempotent). */
export async function connectRedis(): Promise<void> {
  if (redis.status === 'ready' || redis.status === 'connecting') return;
  try {
    await redis.connect();
  } catch (error) {
    log.warn('Redis unavailable at startup — continuing with degraded caching', {
      message: (error as Error).message,
    });
  }
}

/** Whether Redis is currently usable. */
export function isRedisReady(): boolean {
  return ready && redis.status === 'ready';
}

/** Close the connection during graceful shutdown. */
export async function disconnectRedis(): Promise<void> {
  try {
    await redis.quit();
    log.info('Redis connection closed');
  } catch {
    redis.disconnect();
  }
}

/** Health probe returning latency in ms. */
export async function redisHealth(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  await redis.ping();
  return { ok: true, latencyMs: Date.now() - start };
}
