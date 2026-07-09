/**
 * Health & readiness endpoints.
 *  GET /health       — liveness (always 200 if the process is up)
 *  GET /health/ready — readiness (checks DB + Redis)
 */
import { Router } from 'express';
import { databaseHealth } from '../../database/prisma';
import { redisHealth, isRedisReady } from '../../database/redis';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

healthRouter.get('/ready', async (_req, res) => {
  const [db, redis] = await Promise.allSettled([databaseHealth(), redisHealth()]);
  const dbOk = db.status === 'fulfilled';
  // Redis is non-critical (degrades gracefully), so it doesn't fail readiness.
  const ready = dbOk;
  res.status(ready ? 200 : 503).json({
    ready,
    database: dbOk ? { ok: true, latencyMs: db.value.latencyMs } : { ok: false },
    redis: {
      ok: redis.status === 'fulfilled',
      degraded: !isRedisReady(),
    },
  });
});
