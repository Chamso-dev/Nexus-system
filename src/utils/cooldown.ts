/**
 * Command cooldown & generic rate limiting backed by Redis (memory fallback).
 *
 * Cooldowns prevent a single user from spamming a command; rate limits protect
 * shared upstream providers. Both use the same atomic counter approach.
 */
import { redis, isRedisReady } from '../database/redis';
import { cache } from '../services/cache.service';

/**
 * Check & consume a cooldown for a (command, user) pair.
 * Returns 0 if allowed, or the remaining seconds if still cooling down.
 */
export async function checkCooldown(
  scope: string,
  userId: string,
  seconds: number,
): Promise<number> {
  if (seconds <= 0) return 0;
  const key = `cooldown:${scope}:${userId}`;

  if (isRedisReady()) {
    // SET NX with expiry is atomic — the first caller wins the window.
    const set = await redis.set(`nexus:${key}`, '1', 'EX', seconds, 'NX');
    if (set === 'OK') return 0;
    const ttl = await redis.ttl(`nexus:${key}`);
    return ttl > 0 ? ttl : 0;
  }

  // Memory fallback via cache service.
  const existing = await cache.getRaw(key);
  if (existing) return seconds; // approximate — no per-key TTL introspection
  await cache.setRaw(key, '1', seconds);
  return 0;
}

/**
 * Fixed-window rate limiter. Returns whether the action is allowed and the
 * current count. Used for API endpoints and heavy commands.
 */
export async function rateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number; count: number }> {
  const key = `nexus:ratelimit:${scope}:${identifier}`;

  if (isRedisReady()) {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSeconds);
    return { allowed: count <= limit, remaining: Math.max(0, limit - count), count };
  }

  // Best-effort in-memory counter.
  const current = Number((await cache.getRaw(key)) ?? '0') + 1;
  await cache.setRaw(key, String(current), windowSeconds);
  return { allowed: current <= limit, remaining: Math.max(0, limit - current), count: current };
}
