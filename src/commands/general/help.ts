/**
 * /help — dynamic command catalog grouped by category, powered by a select
 * menu so users can drill into each module. Demonstrates select-menu UI.
 */
import { ActionRowBuilder, SlashCommandBuilder, StringSelectMenuBuilder } from 'discord.js';
import type { Command, CommandCategory } from '../../types/discord';
import type { NexusClient } from '../../core/NexusClient';
import { baseEmbed } from '../../utils/embeds';
import { BRAND, EMOJI } from '../../config/constants';

const command: Command = {
  category: 'General',
  cooldown: 3,
  data: new SlashCommandBuilder().setName('help').setDescription('List Nexus commands & features.'),
  async execute(interaction) {
    const client = interaction.client as NexusClient;

    // Group commands by category for the overview.
    const byCategory = new Map<CommandCategory, string[]>();
    for (const cmd of client.commands.values()) {
      const list = byCategory.get(cmd.category) ?? [];
      list.push(`\`/${cmd.data.name}\``);
      byCategory.set(cmd.category, list);
    }

    const embed = baseEmbed()
      .setTitle(`${EMOJI.gem} ${BRAND.name} — Command Guide`)
      .setDescription(`${BRAND.tagline}\n\nSelect a category below, or browse everything:`);

    for (const [category, cmds] of byCategory) {
      embed.addFields({ name: category, value: cmds.join(' '), inline: false });
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId('help')
      .setPlaceholder('Jump to a category…')
      .addOptions(
        [...byCategory.keys()].map((category) => ({
          label: category,
          value: category,
          description: `View ${category} commands`,
        })),
      );

    await interaction.reply({
      embeds: [embed],
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
    });
  },
};

export default command;
