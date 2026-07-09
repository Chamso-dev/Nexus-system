/**
 * Slash-command deployment (production / global).
 *
 * Registers every command + context menu GLOBALLY. Global commands are visible
 * in every server the bot joins but can take up to an hour to propagate — run
 * this once per release in production.
 *
 * Usage: npm run deploy:commands:global
 */
import path from 'node:path';
import { NexusClient } from '../core/NexusClient';
import { loadCommands, loadContextMenus } from '../core/loaders';
import { registerCommands } from '../core/commandRegistry';
import { createLogger } from '../utils/logger';

const log = createLogger('DeployCommandsGlobal');

async function deploy(): Promise<void> {
  const client = new NexusClient();
  const base = path.join(__dirname, '..');
  loadCommands(client, base);
  loadContextMenus(client, base);

  const count = await registerCommands(client, { global: true });
  log.info(`✅ Deployed ${count} commands globally. Propagation may take up to 1 hour.`);
}

deploy()
  .then(() => process.exit(0))
  .catch((error) => {
    log.error('Global command deployment failed', { message: (error as Error).message });
    process.exit(1);
  });
