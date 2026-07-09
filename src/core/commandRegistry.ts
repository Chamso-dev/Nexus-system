/**
 * Command registration.
 *
 * Single source of truth for turning loaded command modules into Discord API
 * payloads and PUTting them to Discord — used by:
 *   - startup auto-registration (guild, development)
 *   - the deploy scripts (guild or global)
 *
 * Guild registration is instant; global registration can take up to an hour to
 * propagate, so it's reserved for production via a dedicated script.
 */
import { REST, RESTPostAPIApplicationCommandsJSONBody, Routes } from 'discord.js';
import { env } from '../config/env';
import { createLogger } from '../utils/logger';
import type { NexusClient } from './NexusClient';

const log = createLogger('CommandRegistry');

/** Serialize every loaded slash command + context menu into API payloads. */
export function buildCommandPayload(client: NexusClient): RESTPostAPIApplicationCommandsJSONBody[] {
  return [
    ...client.commands.map((c) => c.data.toJSON() as RESTPostAPIApplicationCommandsJSONBody),
    ...client.contextMenus.map((c) => c.data.toJSON() as RESTPostAPIApplicationCommandsJSONBody),
  ];
}

export interface RegisterOptions {
  /** Register globally (production) instead of to a single guild. */
  global?: boolean;
  /** Override the target guild (defaults to DISCORD_DEV_GUILD_ID). */
  guildId?: string;
}

/**
 * Register the client's commands with Discord.
 * @returns the number of commands registered.
 */
export async function registerCommands(
  client: NexusClient,
  options: RegisterOptions = {},
): Promise<number> {
  const body = buildCommandPayload(client);
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

  if (options.global) {
    await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body });
    log.info(`Registered ${body.length} commands globally (may take up to 1h to appear)`);
    return body.length;
  }

  const guildId = options.guildId ?? env.DISCORD_DEV_GUILD_ID;
  if (!guildId) {
    throw new Error(
      'No guild specified for command registration. Set ALLOWED_GUILD_ID (or DISCORD_DEV_GUILD_ID), ' +
        'or register globally.',
    );
  }
  await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, guildId), { body });
  log.info(`Registered ${body.length} commands to guild ${guildId}`);
  return body.length;
}
