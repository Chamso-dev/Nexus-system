/**
 * /whale — whale-alert configuration & info.
 *
 * `info` explains thresholds; `feed` (guild admins) routes the whale feed to a
 * channel. Whale detection itself runs in the scheduler for watched wallets.
 */
import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/discord';
import { guildRepository } from '../../database/repositories/misc.repository';
import { DEFAULT_WHALE_THRESHOLDS_USD } from '../../services/whale.service';
import { successEmbed, infoEmbed } from '../../utils/embeds';
import { formatUsd } from '../../utils/format';

const command: Command = {
  category: 'Wallet',
  cooldown: 4,
  data: new SlashCommandBuilder()
    .setName('whale')
    .setDescription('Whale-alert settings and info.')
    .addSubcommand((sub) => sub.setName('info').setDescription('Show default whale thresholds.'))
    .addSubcommand((sub) =>
      sub
        .setName('feed')
        .setDescription('(Admin) Route the whale feed to a channel.')
        .addChannelOption((o) =>
          o
            .setName('channel')
            .setDescription('Target channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        ),
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'info') {
      const lines = Object.entries(DEFAULT_WHALE_THRESHOLDS_USD)
        .filter(([asset]) => asset !== 'DEFAULT')
        .map(([asset, usd]) => `**${asset}** ≥ ${formatUsd(usd)}`)
        .join('\n');
      await interaction.reply({
        embeds: [
          infoEmbed(
            '🐋 Whale Alert Thresholds',
            `Transfers above these USD values are flagged as whale moves:\n\n${lines}\n\n` +
              'Per-wallet thresholds can be set with `/wallet threshold`.',
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    // sub === 'feed' — requires Manage Guild.
    const member = interaction.memberPermissions;
    if (!interaction.inGuild() || !member?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: 'You need the **Manage Server** permission to configure the whale feed.',
        ephemeral: true,
      });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    const channel = interaction.options.getChannel('channel', true);
    await guildRepository.upsert(interaction.guildId!, interaction.guild?.name ?? undefined);
    await guildRepository.updateSettings(interaction.guildId!, {
      whaleChannelId: channel.id,
      whaleFeedEnabled: true,
    });
    await interaction.editReply({
      embeds: [successEmbed('Whale feed enabled', `Whale alerts will post to <#${channel.id}>.`)],
    });
  },
};

export default command;
