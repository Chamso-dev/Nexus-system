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
import { registerCommands } from './core/commandRegistry';
import { isProduction } from './config/env';

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

  log.info('Modules loaded', {
    commands: client.commands.size,
    contextMenus: client.contextMenus.size,
    buttons: client.buttons.size,
    selectMenus: client.selectMenus.size,
  });

  // 3. HTTP API (starts before login so health checks pass during connect).
  const server = await startApiServer(client);

  // 4. Log in to the Discord gateway — exit cleanly if authentication fails.
  try {
    await client.login(env.DISCORD_TOKEN);
  } catch (error) {
    const message = toError(error).message;
    log.error(
      'Discord authentication failed — check DISCORD_TOKEN in your .env. Shutting down.',
      { message },
    );
    server.close();
    await disconnectRedis().catch(() => undefined);
    await disconnectDatabase().catch(() => undefined);
    process.exit(1);
  }

  // 5. Register slash commands.
  //    - Development: auto-register to the dev/allowed guild for instant updates.
  //    - Production: skip auto-registration; deploy globally via
  //      `npm run deploy:commands:global` as a release step.
  await registerSlashCommands(client);

  // 6. Background scheduler (prices, wallets, gas, news, alerts every minute).
  scheduler.start(jobs);

  registerShutdown(client, server);
  log.info('Nexus is fully operational 🚀', { guilds: client.guilds.cache.size });
}

/**
 * Register slash commands appropriately for the environment. Command
 * registration failures are non-fatal — the bot stays online and the operator
 * can re-run the deploy script.
 */
async function registerSlashCommands(client: NexusClient): Promise<void> {
  try {
    // Auto-register to the configured guild when it's set and either we're in
    // development OR the bot is scoped to that single guild (RESTRICT_TO_GUILD).
    // This makes single-server deployments (e.g. Railway) work out of the box.
    const shouldGuildRegister =
      Boolean(env.DISCORD_DEV_GUILD_ID) && (!isProduction || env.RESTRICT_TO_GUILD);

    if (shouldGuildRegister) {
      const count = await registerCommands(client, { guildId: env.DISCORD_DEV_GUILD_ID });
      log.info(`Auto-registered ${count} commands to guild ${env.DISCORD_DEV_GUILD_ID}`);
    } else if (isProduction) {
      log.info(
        'Production mode with no scoped guild: skipping auto-registration. ' +
          'Run `npm run deploy:commands:global` to publish commands globally.',
      );
    } else {
      log.warn(
        'No ALLOWED_GUILD_ID/DISCORD_DEV_GUILD_ID set — skipping auto-registration. ' +
          'Set it to auto-register commands to your server, or run `npm run deploy:commands`.',
      );
    }
  } catch (error) {
    log.error('Command auto-registration failed (bot stays online)', {
      message: toError(error).message,
    });
  }
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
