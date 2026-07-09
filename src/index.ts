/**
 * Application entrypoint.
 *
 * Bootstraps every subsystem in the correct order and wires graceful shutdown:
 *   1. Validate env (side-effect of importing config)
 *   2. Connect database & Redis
 *   3. Build the Discord client + load all modules
 *   4. Start the HTTP API
 *   5. Log in to Discord
 *   6. Start the scheduler
 *
 * Any fatal error during startup exits the process so an orchestrator (Docker,
 * PM2, systemd) can restart it cleanly.
 */
import http from 'node:http';
import { env } from './config/env';
import { logger, createLogger } from './utils/logger';
import { NexusClient } from './core/NexusClient';
import { loadAll } from './core/loaders';
import { connectDatabase, disconnectDatabase } from './database/prisma';
import { connectRedis, disconnectRedis } from './database/redis';
import { notificationService } from './services/notification.service';
import { startApiServer } from './api/server';
import { scheduler } from './jobs/scheduler';
import { jobs } from './jobs';
import { toError } from './utils/errors';

const log = createLogger('Bootstrap');

async function main(): Promise<void> {
  log.info('Starting Nexus Crypto Bot', { env: env.NODE_ENV });

  // 1. Infrastructure connections.
  await connectDatabase();
  await connectRedis();

  // 2. Discord client + module loading.
  const client = new NexusClient();
  loadAll(client, __dirname);
  notificationService.bindClient(client);

  // 3. HTTP API (starts before login so health checks pass during connect).
  const server = await startApiServer(client);

  // 4. Log in to the Discord gateway.
  await client.login(env.DISCORD_TOKEN);

  // 5. Background scheduler.
  scheduler.start(jobs);

  registerShutdown(client, server);
  log.info('Nexus is fully operational 🚀');
}

/** Wire SIGINT/SIGTERM + unhandled rejections to a clean shutdown. */
function registerShutdown(client: NexusClient, server: http.Server): void {
  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.warn(`Received ${signal} — shutting down gracefully…`);

    // Stop accepting new work first.
    scheduler.stop();
    server.close();

    try {
      client.destroy();
      await disconnectRedis();
      await disconnectDatabase();
    } catch (error) {
      log.error('Error during shutdown', { message: toError(error).message });
    } finally {
      log.info('Shutdown complete. Goodbye 👋');
      process.exit(0);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  // Never crash on an unhandled rejection — log it and keep serving.
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { message: toError(reason).message });
  });
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { message: error.message, stack: error.stack });
  });
}

main().catch((error) => {
  log.error('Fatal startup error', { message: toError(error).message, stack: toError(error).stack });
  process.exit(1);
});
