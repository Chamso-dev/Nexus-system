/**
 * Button handler for the /market "Refresh" button (customId `market:refresh`).
 * Re-fetches the overview and updates the original message in place.
 */
import type { ButtonHandler } from '../types/discord';
import { priceService } from '../services/price.service';
import { marketEmbed } from '../utils/domainEmbeds';

const handler: ButtonHandler = {
  id: 'market',
  async execute(interaction, args) {
    if (args[0] !== 'refresh') return;
    await interaction.deferUpdate();
    const overview = await priceService.getMarketOverview();
    await interaction.editReply({ embeds: [marketEmbed(overview)] });
  },
};

export default handler;
