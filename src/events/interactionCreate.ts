/**
 * Central interaction router.
 *
 * Dispatches every incoming interaction to the right handler:
 *  - chat-input commands (with guard middleware + usage logging)
 *  - autocomplete
 *  - context menus
 *  - buttons & select menus (routed by customId prefix `id:arg1:arg2`)
 *
 * All errors are funneled through `replyError` so users always get feedback.
 */
import { Events, Interaction, MessageFlags } from 'discord.js';
import type { NexusClient } from '../core/NexusClient';
import type { EventModule } from '../types/discord';
import { createLogger } from '../utils/logger';
import { isAppError, toError } from '../utils/errors';
import { runGuards } from '../middlewares/guards';
import { errorEmbed } from '../utils/embeds';
import { metrics } from '../services/metrics.service';
import { env } from '../config/env';

const log = createLogger('Interaction');

/** Respond with an error embed, choosing reply vs. followUp appropriately. */
async function replyError(interaction: Interaction, message: string): Promise<void> {
  if (!interaction.isRepliable()) return;
  const embed = errorEmbed('Error', message);
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  } catch (error) {
    log.error('Failed to send error reply', { message: toError(error).message });
  }
}

const event: EventModule<typeof Events.InteractionCreate> = {
  name: Events.InteractionCreate,
  async execute(...args: unknown[]) {
    const interaction = args[0] as Interaction;
    const client = interaction.client as NexusClient;

    // Guild allow-list: when RESTRICT_TO_GUILD is on, ignore interactions from
    // any guild other than the configured ALLOWED_GUILD_ID (DMs still allowed).
    if (
      env.RESTRICT_TO_GUILD &&
      env.DISCORD_DEV_GUILD_ID &&
      interaction.inGuild() &&
      interaction.guildId !== env.DISCORD_DEV_GUILD_ID
    ) {
      if (interaction.isAutocomplete()) {
        await interaction.respond([]);
      } else if (interaction.isRepliable()) {
        await interaction.reply({
          content: 'This bot is restricted to its home server.',
          flags: MessageFlags.Ephemeral,
        });
      }
      return;
    }

    try {
      // ----- Autocomplete -------------------------------------------------
      if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (command?.autocomplete) await command.autocomplete(interaction);
        return;
      }

      // ----- Slash commands ----------------------------------------------
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) {
          await replyError(interaction, 'Unknown command.');
          return;
        }
        await runGuards(interaction, command);
        const start = Date.now();
        await command.execute(interaction);
        metrics.recordCommand(interaction.commandName, Date.now() - start);
        log.info('Command executed', {
          command: interaction.commandName,
          user: interaction.user.id,
          guild: interaction.guildId ?? 'dm',
          ms: Date.now() - start,
        });
        return;
      }

      // ----- Context menus -----------------------------------------------
      if (interaction.isContextMenuCommand()) {
        const command = client.contextMenus.get(interaction.commandName);
        if (command) await command.execute(interaction);
        return;
      }

      // ----- Buttons ------------------------------------------------------
      if (interaction.isButton()) {
        const [id, ...routeArgs] = interaction.customId.split(':');
        const handler = client.buttons.get(id);
        if (handler) await handler.execute(interaction, routeArgs);
        return;
      }

      // ----- Select menus -------------------------------------------------
      if (interaction.isStringSelectMenu()) {
        const [id, ...routeArgs] = interaction.customId.split(':');
        const handler = client.selectMenus.get(id);
        if (handler) await handler.execute(interaction, routeArgs);
        return;
      }
    } catch (error) {
      const err = toError(error);
      metrics.recordError();
      const userMessage = isAppError(error) && error.isOperational ? err.message : undefined;
      if (!isAppError(error) || !error.isOperational) {
        log.error('Unhandled interaction error', {
          command: interaction.isCommand() ? interaction.commandName : interaction.type,
          message: err.message,
          stack: err.stack,
        });
      }
      await replyError(interaction, userMessage ?? 'Something went wrong. Please try again later.');
    }
  },
};

export default event;
