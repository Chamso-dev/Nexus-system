/**
 * Ready event — fired once when the gateway connection is established.
 * Sets presence and records the ready timestamp for uptime reporting.
 */
import { ActivityType, Client, Events } from 'discord.js';
import type { NexusClient } from '../core/NexusClient';
import type { EventModule } from '../types/discord';
import { createLogger } from '../utils/logger';

const log = createLogger('Ready');

const event: EventModule<typeof Events.ClientReady> = {
  name: Events.ClientReady,
  once: true,
  async execute(...args: unknown[]) {
    const client = args[0] as Client<true> & NexusClient;
    client.readyTimestamp2 = Date.now();

    log.info(`Logged in as ${client.user.tag}`, {
      guilds: client.guilds.cache.size,
      commands: client.commands.size,
    });

    client.user.setPresence({
      status: 'online',
      activities: [{ name: '/market • crypto', type: ActivityType.Watching }],
    });
  },
};

export default event;
