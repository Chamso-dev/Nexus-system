/**
 * /price <asset> — live price with 24H/7D/30D change. Demonstrates autocomplete
 * (asset search) backed by the price provider.
 */
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/discord';
import { priceService } from '../../services/price.service';
import { priceEmbed } from '../../utils/domainEmbeds';
import { errorEmbed } from '../../utils/embeds';

const command: Command = {
  category: 'Market',
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('price')
    .setDescription('Get the live price of a crypto asset.')
    .addStringOption((opt) =>
      opt
        .setName('asset')
        .setDescription('Asset name or symbol (e.g. bitcoin, eth)')
        .setRequired(true)
        .setAutocomplete(true),
    ),
  async execute(interaction) {
    await interaction.deferReply();
    const assetId = interaction.options.getString('asset', true);
    const quote = await priceService.getQuote(assetId);
    if (!quote) {
      await interaction.editReply({
        embeds: [errorEmbed('Not found', `No price data for \`${assetId}\`.`)],
      });
      return;
    }
    await interaction.editReply({ embeds: [priceEmbed(quote)] });
  },
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    if (!focused) {
      await interaction.respond([
        { name: 'Bitcoin (BTC)', value: 'bitcoin' },
        { name: 'Ethereum (ETH)', value: 'ethereum' },
        { name: 'Solana (SOL)', value: 'solana' },
      ]);
      return;
    }
    const results = await priceService.search(focused);
    await interaction.respond(
      results.slice(0, 25).map((r) => ({ name: `${r.name} (${r.symbol.toUpperCase()})`, value: r.id })),
    );
  },
};

export default command;
