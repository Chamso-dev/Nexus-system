/**
 * Slash-command deployment script.
 *
 * Reads every command + context-menu module and registers them with Discord via
 * the REST API. With DISCORD_DEV_GUILD_ID set it deploys to that guild
 * (instant, for development); otherwise it deploys globally (can take up to an
 * hour to propagate).
 *
 * Usage: `npm run deploy:commands`
 */
import { REST, Routes } from 'discord.js';
import path from 'node:path';
import { env } from '../config/env';
import { NexusClient } from '../core/NexusClient';
import { loadCommands, loadContextMenus } from '../core/loaders';
import { createLogger } from '../utils/logger';

const log = createLogger('DeployCommands');

async function deploy(): Promise<void> {
  // Reuse the loaders to collect command definitions without logging in.
  const client = new NexusClient();
  const base = path.join(__dirname, '..');
  loadCommands(client, base);
  loadContextMenus(client, base);

  const body = [
    ...client.commands.map((c) => c.data.toJSON()),
    ...client.contextMenus.map((c) => c.data.toJSON()),
  ];

  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

  if (env.DISCORD_DEV_GUILD_ID) {
    await rest.put(
      Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_DEV_GUILD_ID),
      { body },
    );
    log.info(`Deployed ${body.length} commands to dev guild ${env.DISCORD_DEV_GUILD_ID}`);
  } else {
    await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body });
    log.info(`Deployed ${body.length} commands globally`);
  }
}

deploy()
  .then(() => process.exit(0))
  .catch((error) => {
    log.error('Command deployment failed', { message: (error as Error).message });
    process.exit(1);
  });
