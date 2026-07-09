/**
 * Guild join handler — persists a lightweight Guild row for scale metrics
 * and per-guild settings.
 */
import { Events, Guild } from 'discord.js';
import type { EventModule } from '../types/discord';
import { prisma } from '../database/prisma';
import { createLogger } from '../utils/logger';

const log = createLogger('GuildCreate');

const event: EventModule<typeof Events.GuildCreate> = {
  name: Events.GuildCreate,
  async execute(...args: unknown[]) {
    const guild = args[0] as Guild;
    await prisma.guild.upsert({
      where: { id: guild.id },
      create: { id: guild.id, name: guild.name },
      update: { name: guild.name },
    });
    log.info('Joined guild', { id: guild.id, name: guild.name, members: guild.memberCount });
  },
};

export default event;
