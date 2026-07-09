/**
 * /profile — a user's Nexus profile: wallets, alerts, portfolios, watchlist,
 * notification preferences, timezone, premium status and stats. Includes a
 * settings button that opens a select-menu of toggles.
 */
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/discord';
import { userService } from '../../services/user.service';
import { walletRepository } from '../../database/repositories/wallet.repository';
import { alertRepository } from '../../database/repositories/alert.repository';
import { portfolioRepository } from '../../database/repositories/portfolio.repository';
import { baseEmbed } from '../../utils/embeds';
import { EMOJI } from '../../config/constants';

const command: Command = {
  category: 'Profile',
  cooldown: 4,
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your Nexus profile & stats.')
    .addSubcommand((sub) => sub.setName('view').setDescription('View your profile.'))
    .addSubcommand((sub) =>
      sub
        .setName('timezone')
        .setDescription('Set your timezone (IANA name, e.g. Europe/Paris).')
        .addStringOption((o) => o.setName('tz').setDescription('IANA timezone').setRequired(true)),
    ),
  async execute(interaction) {
    const user = await userService.ensure(interaction.user.id, interaction.user.username);
    const sub = interaction.options.getSubcommand();

    if (sub === 'timezone') {
      await interaction.deferReply({ ephemeral: true });
      const tz = interaction.options.getString('tz', true);
      // Validate against the runtime's timezone database.
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
      } catch {
        await interaction.editReply({ content: `\`${tz}\` is not a valid IANA timezone.` });
        return;
      }
      await userService.updateTimezone(interaction.user.id, tz);
      await interaction.editReply({ content: `Timezone set to **${tz}**.` });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    const [wallets, alerts, portfolios, isPremium, settings] = await Promise.all([
      walletRepository.countByUser(interaction.user.id),
      alertRepository.countActiveByUser(interaction.user.id),
      portfolioRepository.countByUser(interaction.user.id),
      userService.isPremium(interaction.user.id),
      userService.getSettings(interaction.user.id),
    ]);

    const embed = baseEmbed()
      .setTitle(`${EMOJI.gem} ${interaction.user.username}'s Profile`)
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        { name: 'Wallets', value: String(wallets), inline: true },
        { name: 'Active Alerts', value: String(alerts), inline: true },
        { name: 'Portfolios', value: String(portfolios), inline: true },
        { name: 'Premium', value: isPremium ? `${EMOJI.check} ${user.premiumTier}` : 'Free', inline: true },
        { name: 'Timezone', value: user.timezone, inline: true },
        { name: 'Locale', value: user.locale, inline: true },
      );

    if (settings) {
      embed.addFields({
        name: 'Notifications',
        value:
          `DM Alerts: ${settings.dmAlerts ? '✅' : '❌'} · ` +
          `Whale: ${settings.whaleAlerts ? '✅' : '❌'} · ` +
          `Price: ${settings.priceAlerts ? '✅' : '❌'} · ` +
          `Gas: ${settings.gasAlerts ? '✅' : '❌'} · ` +
          `News: ${settings.newsAlerts ? '✅' : '❌'}`,
      });
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('profile:settings')
        .setLabel('Notification Settings')
        .setEmoji('⚙️')
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  },
};

export default command;
