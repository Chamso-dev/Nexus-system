/**
 * /news — latest crypto news with AI summaries, category filtering, and
 * per-category subscriptions. Uses pagination for the article list.
 */
import { SlashCommandBuilder } from 'discord.js';
import { NewsCategory } from '@prisma/client';
import type { Command } from '../../types/discord';
import { newsService } from '../../services/news.service';
import { newsRepository } from '../../database/repositories/misc.repository';
import { userService } from '../../services/user.service';
import { baseEmbed, successEmbed, infoEmbed } from '../../utils/embeds';
import { paginate } from '../../utils/pagination';
import { EMOJI } from '../../config/constants';
import { discordTimestamp, truncate } from '../../utils/format';
import { NewsItem } from '../../types';

const categoryChoices = Object.values(NewsCategory).map((c) => ({ name: c, value: c }));

/** Build one embed per 5 articles for pagination. */
function buildPages(items: NewsItem[], title: string) {
  const pages = [];
  for (let i = 0; i < items.length; i += 5) {
    const slice = items.slice(i, i + 5);
    const embed = baseEmbed().setTitle(`${EMOJI.news} ${title}`);
    for (const item of slice) {
      embed.addFields({
        name: truncate(item.title, 240),
        value:
          `${truncate(item.summary ?? '', 200)}\n` +
          `[${item.source ?? 'source'}](${item.url}) • ${discordTimestamp(item.publishedAt)}`,
      });
    }
    pages.push(embed);
  }
  return pages.length ? pages : [baseEmbed().setTitle(title).setDescription('No news available.')];
}

const command: Command = {
  category: 'News',
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('news')
    .setDescription('Latest crypto news & summaries.')
    .addSubcommand((sub) =>
      sub
        .setName('latest')
        .setDescription('Show the latest news.')
        .addStringOption((o) =>
          o.setName('category').setDescription('Filter by category').addChoices(...categoryChoices),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('subscribe')
        .setDescription('Subscribe to a news category (DM digests).')
        .addStringOption((o) =>
          o.setName('category').setDescription('Category').setRequired(true).addChoices(...categoryChoices),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('unsubscribe')
        .setDescription('Unsubscribe from a news category.')
        .addStringOption((o) =>
          o.setName('category').setDescription('Category').setRequired(true).addChoices(...categoryChoices),
        ),
    )
    .addSubcommand((sub) => sub.setName('subscriptions').setDescription('List your news subscriptions.')),
  async execute(interaction) {
    await userService.ensure(interaction.user.id, interaction.user.username);
    const sub = interaction.options.getSubcommand();

    if (sub === 'latest') {
      await interaction.deferReply();
      const category = interaction.options.getString('category') as NewsCategory | null;
      const items = category
        ? await newsService.fetchByCategory(category)
        : await newsService.fetchLatest(20);
      await paginate(interaction, {
        pages: buildPages(items, category ? `${category} News` : 'Latest Crypto News'),
        userId: interaction.user.id,
      });
      return;
    }

    if (sub === 'subscribe') {
      await interaction.deferReply({ ephemeral: true });
      const category = interaction.options.getString('category', true) as NewsCategory;
      await newsRepository.subscribe(interaction.user.id, category);
      await interaction.editReply({ embeds: [successEmbed('Subscribed', `You'll receive **${category}** news.`)] });
      return;
    }

    if (sub === 'unsubscribe') {
      await interaction.deferReply({ ephemeral: true });
      const category = interaction.options.getString('category', true) as NewsCategory;
      await newsRepository.unsubscribe(interaction.user.id, category);
      await interaction.editReply({ embeds: [successEmbed('Unsubscribed', `Removed **${category}**.`)] });
      return;
    }

    if (sub === 'subscriptions') {
      await interaction.deferReply({ ephemeral: true });
      const subs = await newsRepository.listSubscriptions(interaction.user.id);
      await interaction.editReply({
        embeds: [
          infoEmbed(
            'Your subscriptions',
            subs.length ? subs.map((s) => `• ${s.category}`).join('\n') : 'None yet.',
          ),
        ],
      });
      return;
    }
  },
};

export default command;
