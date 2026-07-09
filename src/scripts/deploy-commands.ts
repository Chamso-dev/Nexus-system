/**
 * Slash-command deployment (development / guild-scoped).
 *
 * Loads every command + context-menu module and registers them to the guild in
 * ALLOWED_GUILD_ID (a.k.a. DISCORD_DEV_GUILD_ID) — instant propagation, ideal
 * for development. Pass `--global` to force a global deploy instead.
 *
 * Usage:
 *   npm run deploy:commands            # guild (uses ALLOWED_GUILD_ID)
 *   npm run deploy:commands -- --global
 */
import path from 'node:path';
import { NexusClient } from '../core/NexusClient';
import { loadCommands, loadContextMenus } from '../core/loaders';
import { registerCommands } from '../core/commandRegistry';
import { env } from '../config/env';
import { createLogger } from '../utils/logger';

const log = createLogger('DeployCommands');

async function deploy(): Promise<void> {
  const global = process.argv.includes('--global');

  // Reuse the loaders to collect command definitions without logging in.
  const client = new NexusClient();
  const base = path.join(__dirname, '..');
  loadCommands(client, base);
  loadContextMenus(client, base);

  if (!global && !env.DISCORD_DEV_GUILD_ID) {
    log.error(
      'ALLOWED_GUILD_ID (or DISCORD_DEV_GUILD_ID) is not set. ' +
        'Set it for a guild deploy, or run with --global for production.',
    );
    process.exit(1);
  }

  const count = await registerCommands(client, { global });
  log.info(`✅ Deployed ${count} commands ${global ? 'globally' : `to guild ${env.DISCORD_DEV_GUILD_ID}`}`);
}

deploy()
  .then(() => process.exit(0))
  .catch((error) => {
    log.error('Command deployment failed', { message: (error as Error).message });
    process.exit(1);
  });
