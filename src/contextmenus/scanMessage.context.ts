/**
 * Message context menu: "Scan for contract address".
 *
 * Right-click a message → Apps → Scan for contract address. Extracts the first
 * 0x EVM address from the message and runs the risk scanner against Ethereum.
 */
import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  MessageContextMenuCommandInteraction,
} from 'discord.js';
import { Chain } from '@prisma/client';
import type { ContextMenuCommand } from '../types/discord';
import { contractService } from '../services/contract.service';
import { contractEmbed } from '../utils/domainEmbeds';
import { errorEmbed } from '../utils/embeds';

const EVM_ADDRESS = /0x[a-fA-F0-9]{40}/;

const command: ContextMenuCommand = {
  data: new ContextMenuCommandBuilder()
    .setName('Scan for contract address')
    .setType(ApplicationCommandType.Message),
  async execute(interaction) {
    const message = (interaction as MessageContextMenuCommandInteraction).targetMessage;
    const match = message.content.match(EVM_ADDRESS);
    if (!match) {
      await interaction.reply({
        embeds: [errorEmbed('No address found', 'That message has no EVM (0x…) address.')],
        ephemeral: true,
      });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    const report = await contractService.scan(Chain.ETHEREUM, match[0]);
    await interaction.editReply({ embeds: [contractEmbed(report)] });
  },
};

export default command;
