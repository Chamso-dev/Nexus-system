/**
 * /airdrop — browse tracked airdrops with project, deadline, requirements,
 * estimated reward, status, risk level and official links. Paginated.
 */
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/discord';
import { airdropService } from '../../services/airdrop.service';
import { baseEmbed } from '../../utils/embeds';
import { paginate } from '../../utils/pagination';
import { EMOJI } from '../../config/constants';
import { discordTimestamp } from '../../utils/format';

const command: Command = {
  category: 'Airdrops',
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('airdrop')
    .setDescription('Browse tracked crypto airdrops.')
    .addStringOption((o) =>
      o
        .setName('status')
        .setDescription('Filter by status')
        .addChoices(
          { name: 'Upcoming', value: 'UPCOMING' },
          { name: 'Live', value: 'LIVE' },
          { name: 'Ended', value: 'ENDED' },
        ),
    ),
  async execute(interaction) {
    await interaction.deferReply();
    const status = interaction.options.getString('status') ?? undefined;
    const airdrops = await airdropService.list(status);

    if (!airdrops.length) {
      await interaction.editReply({
        embeds: [
          baseEmbed()
            .setTitle(`${EMOJI.rocket} Airdrops`)
            .setDescription('No airdrops are currently tracked. Check back soon!'),
        ],
      });
      return;
    }

    const pages = [];
    for (let i = 0; i < airdrops.length; i += 4) {
      const embed = baseEmbed().setTitle(`${EMOJI.rocket} Tracked Airdrops`);
      for (const a of airdrops.slice(i, i + 4)) {
        const parts = [
          a.deadline ? `⏰ Deadline: ${discordTimestamp(a.deadline)}` : null,
          a.estReward ? `${EMOJI.gem} Reward: ${a.estReward}` : null,
          `📊 Status: ${a.status} · Risk: ${a.riskLevel}`,
          a.requirements ? `📋 ${a.requirements}` : null,
          a.officialUrl ? `🔗 [Official](${a.officialUrl})` : null,
        ].filter(Boolean);
        embed.addFields({ name: a.project, value: parts.join('\n') || '—' });
      }
      pages.push(embed);
    }
    await paginate(interaction, { pages, userId: interaction.user.id });
  },
};

export default command;
