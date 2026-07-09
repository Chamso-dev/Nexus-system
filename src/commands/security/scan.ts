/**
 * /scan — smart-contract risk scanner. Inspects publicly available contract
 * metadata and returns risk indicators + a clear "not financial advice"
 * disclaimer (enforced in the embed).
 */
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/discord';
import { contractService } from '../../services/contract.service';
import { contractEmbed } from '../../utils/domainEmbeds';
import { chainChoices, asChain } from '../_shared';

const command: Command = {
  category: 'Security',
  cooldown: 8,
  data: new SlashCommandBuilder()
    .setName('scan')
    .setDescription('Scan a smart contract for common risk indicators.')
    .addStringOption((o) =>
      o.setName('chain').setDescription('Chain').setRequired(true).addChoices(...chainChoices),
    )
    .addStringOption((o) => o.setName('address').setDescription('Contract address').setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply();
    const chain = asChain(interaction.options.getString('chain', true));
    const address = interaction.options.getString('address', true);
    const report = await contractService.scan(chain, address);
    await interaction.editReply({ embeds: [contractEmbed(report)] });
  },
};

export default command;
