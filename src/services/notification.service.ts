/**
 * Notification service — the single outbound path for delivering alerts to
 * users (DM) or guild channels. Jobs and services depend on this abstraction
 * rather than reaching into the discord.js client directly.
 *
 * The client is injected once at bootstrap via `bindClient` so this module has
 * no import-time dependency on the gateway (keeping it testable).
 */
import { EmbedBuilder } from 'discord.js';
import type { NexusClient } from '../core/NexusClient';
import { createLogger } from '../utils/logger';

const log = createLogger('Notifications');

class NotificationService {
  private client: NexusClient | null = null;

  /** Called once during startup. */
  bindClient(client: NexusClient): void {
    this.client = client;
  }

  /** DM a user an embed. Returns whether delivery succeeded. */
  async dmUser(userId: string, embed: EmbedBuilder): Promise<boolean> {
    if (!this.client) return false;
    try {
      const user = await this.client.users.fetch(userId);
      await user.send({ embeds: [embed] });
      return true;
    } catch (error) {
      // Users can have DMs disabled — this is expected, not an error.
      log.debug('DM delivery failed', { userId, message: (error as Error).message });
      return false;
    }
  }

  /** Send an embed to a guild channel by id. */
  async sendToChannel(channelId: string, embed: EmbedBuilder): Promise<boolean> {
    if (!this.client) return false;
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (channel?.isTextBased() && 'send' in channel) {
        await channel.send({ embeds: [embed] });
        return true;
      }
      return false;
    } catch (error) {
      log.debug('Channel delivery failed', { channelId, message: (error as Error).message });
      return false;
    }
  }
}

export const notificationService = new NotificationService();
