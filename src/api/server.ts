/**
 * Express API server.
 *
 * Exposes health, status/metrics, public market summary and a webhook receiver.
 * Runs alongside the bot in the same process (a common pattern for small/medium
 * deployments); it can be split out later without changing routes.
 */
import express, { Application } from 'express';
import http from 'node:http';
import type { NexusClient } from '../core/NexusClient';
import { env } from '../config/env';
import { createLogger } from '../utils/logger';
import {
  requestLogger,
  errorHandler,
  apiRateLimit,
} from '../middlewares/api.middleware';
import { healthRouter } from './routes/health.routes';
import { statusRouter } from './routes/status.routes';
import { marketRouter } from './routes/market.routes';
import { webhookRouter } from './routes/webhook.routes';

const log = createLogger('ApiServer');

export function createApiServer(client: NexusClient): Application {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
  app.use(requestLogger);

  // Routes.
  app.use('/health', healthRouter);
  app.use('/', statusRouter(client));
  app.use('/market', marketRouter);
  app.use('/webhooks', webhookRouter);

  // Root info (rate-limited).
  app.get('/', apiRateLimit(30, 60), (_req, res) => {
    res.json({ name: 'Nexus Crypto Bot API', version: '1.0.0', docs: '/health, /status, /market/summary' });
  });

  // 404 + centralized error handler (must be last).
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use(errorHandler);

  return app;
}

/** Start the HTTP server and resolve with the underlying server handle. */
export function startApiServer(client: NexusClient): Promise<http.Server> {
  const app = createApiServer(client);
  return new Promise((resolve) => {
    const server = app.listen(env.API_PORT, env.API_HOST, () => {
      log.info(`API listening on http://${env.API_HOST}:${env.API_PORT}`);
      resolve(server);
    });
  });
}
