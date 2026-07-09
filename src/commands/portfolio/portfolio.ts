/**
 * /portfolio — track holdings and see value, allocation, 24H change and P/L.
 * (view / add / remove). A default "Main" portfolio is created automatically.
 */
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/discord';
import { portfolioService } from '../../services/portfolio.service';
import { priceService } from '../../services/price.service';
import { userService } from '../../services/user.service';
import { portfolioEmbed } from '../../utils/domainEmbeds';
import { successEmbed, errorEmbed } from '../../utils/embeds';

const command: Command = {
  category: 'Portfolio',
  cooldown: 4,
  data: new SlashCommandBuilder()
    .setName('portfolio')
    .setDescription('Track your crypto holdings.')
    .addSubcommand((sub) => sub.setName('view').setDescription('View your portfolio value & breakdown.'))
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add or update a holding.')
        .addStringOption((o) =>
          o.setName('asset').setDescription('Asset (e.g. bitcoin)').setRequired(true).setAutocomplete(true),
        )
        .addNumberOption((o) => o.setName('amount').setDescription('Amount held').setRequired(true))
        .addNumberOption((o) =>
          o.setName('cost').setDescription('Total cost basis in USD (optional, for P/L)').setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a holding.')
        .addStringOption((o) =>
          o.setName('asset').setDescription('Asset id to remove').setRequired(true).setAutocomplete(true),
        ),
    ),
  async execute(interaction) {
    await userService.ensure(interaction.user.id, interaction.user.username);
    const portfolio = await portfolioService.ensureDefault(interaction.user.id);
    const sub = interaction.options.getSubcommand();

    if (sub === 'view') {
      await interaction.deferReply();
      const valuation = await portfolioService.value(portfolio.id, true);
      await interaction.editReply({ embeds: [portfolioEmbed(valuation)] });
      return;
    }

    if (sub === 'add') {
      await interaction.deferReply({ ephemeral: true });
      const assetId = interaction.options.getString('asset', true);
      const amount = interaction.options.getNumber('amount', true);
      const cost = interaction.options.getNumber('cost') ?? undefined;
      const quote = await priceService.getQuote(assetId);
      if (!quote) {
        await interaction.editReply({ embeds: [errorEmbed('Unknown asset', `No data for \`${assetId}\`.`)] });
        return;
      }
      await portfolioService.setHolding(portfolio.id, assetId, quote.symbol, amount, cost);
      await interaction.editReply({
        embeds: [successEmbed('Holding saved', `${amount} ${quote.symbol} added to **${portfolio.name}**.`)],
      });
      return;
    }

    if (sub === 'remove') {
      await interaction.deferReply({ ephemeral: true });
      await portfolioService.removeHolding(portfolio.id, interaction.options.getString('asset', true));
      await interaction.editReply({ embeds: [successEmbed('Holding removed')] });
      return;
    }
  },
  async autocomplete(interaction) {
    const results = await priceService.search(interaction.options.getFocused());
    await interaction.respond(
      results.slice(0, 25).map((r) => ({ name: `${r.name} (${r.symbol.toUpperCase()})`, value: r.id })),
    );
  },
};

export default command;
