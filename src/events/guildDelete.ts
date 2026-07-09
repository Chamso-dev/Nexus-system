/**
 * Guild leave handler — logs departures for churn metrics. We intentionally
 * keep the Guild row (soft data retention) so re-joins keep their settings.
 */
import { Events, Guild } from 'discord.js';
import type { EventModule } from '../types/discord';
import { createLogger } from '../utils/logger';

const log = createLogger('GuildDelete');

const event: EventModule<typeof Events.GuildDelete> = {
  name: Events.GuildDelete,
  async execute(...args: unknown[]) {
    const guild = args[0] as Guild;
    log.info('Removed from guild', { id: guild.id, name: guild.name });
  },
};

export default event;
