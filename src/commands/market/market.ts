/**
 * /market — the full market dashboard: featured coins, gainers/losers,
 * trending, global cap/volume, BTC dominance and Fear & Greed. Includes a
 * refresh button (button UI demo).
 */
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/discord';
import { priceService } from '../../services/price.service';
import { marketEmbed } from '../../utils/domainEmbeds';

const command: Command = {
  category: 'Market',
  cooldown: 5,
  data: new SlashCommandBuilder().setName('market').setDescription('Show the crypto market dashboard.'),
  async execute(interaction) {
    await interaction.deferReply();
    const overview = await priceService.getMarketOverview();
    const refresh = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('market:refresh')
        .setLabel('Refresh')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary),
    );
    await interaction.editReply({ embeds: [marketEmbed(overview)], components: [refresh] });
  },
};

export default command;
