/**
 * Bot status & metrics endpoints.
 *  GET /status   — public high-level bot status (guild count, uptime)
 *  GET /metrics  — protected detailed metrics (auth required)
 */
import { Router } from 'express';
import type { NexusClient } from '../../core/NexusClient';
import { metrics } from '../../services/metrics.service';
import { requireAuth } from '../../middlewares/api.middleware';

export function statusRouter(client: NexusClient): Router {
  const router = Router();

  router.get('/status', (_req, res) => {
    res.json({
      status: client.isReady() ? 'online' : 'starting',
      guilds: client.guilds.cache.size,
      commands: client.commands.size,
      uptimeMs: client.readyTimestamp2 ? Date.now() - client.readyTimestamp2 : 0,
    });
  });

  // Detailed metrics require the API token.
  router.get('/metrics', requireAuth, (_req, res) => {
    res.json({ ...metrics.snapshot(), guilds: client.guilds.cache.size });
  });

  return router;
}
