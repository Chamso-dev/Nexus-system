/**
 * Button handler for the /profile "Notification Settings" button
 * (customId `profile:settings`). Opens a multi-select of notification toggles.
 */
import { ActionRowBuilder, MessageFlags, StringSelectMenuBuilder } from 'discord.js';
import type { ButtonHandler } from '../types/discord';
import { userService } from '../services/user.service';

const handler: ButtonHandler = {
  id: 'profile',
  async execute(interaction, args) {
    if (args[0] !== 'settings') return;
    const settings = await userService.getSettings(interaction.user.id);

    const menu = new StringSelectMenuBuilder()
      .setCustomId('profileSettings')
      .setPlaceholder('Select which notifications to ENABLE')
      .setMinValues(0)
      .setMaxValues(5)
      .addOptions(
        { label: 'DM Alerts', value: 'dmAlerts', default: settings?.dmAlerts ?? true },
        { label: 'Whale Alerts', value: 'whaleAlerts', default: settings?.whaleAlerts ?? true },
        { label: 'Price Alerts', value: 'priceAlerts', default: settings?.priceAlerts ?? true },
        { label: 'Gas Alerts', value: 'gasAlerts', default: settings?.gasAlerts ?? true },
        { label: 'News Alerts', value: 'newsAlerts', default: settings?.newsAlerts ?? true },
      );

    await interaction.reply({
      content: 'Toggle your notification preferences. Selected = enabled.',
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default handler;
