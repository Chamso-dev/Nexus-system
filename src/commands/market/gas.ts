/**
 * /gas — current gas prices across supported EVM chains. Optionally set a
 * gas-drop alert with `/gas alert`.
 */
import { SlashCommandBuilder } from 'discord.js';
import { AlertType } from '@prisma/client';
import type { Command } from '../../types/discord';
import { gasService } from '../../services/gas.service';
import { alertService } from '../../services/alert.service';
import { userService } from '../../services/user.service';
import { gasEmbed } from '../../utils/domainEmbeds';
import { successEmbed } from '../../utils/embeds';
import { chainChoices, asChain } from '../_shared';

const command: Command = {
  category: 'Market',
  cooldown: 4,
  data: new SlashCommandBuilder()
    .setName('gas')
    .setDescription('Show gas prices, or set a gas-drop alert.')
    .addSubcommand((sub) => sub.setName('show').setDescription('Show current gas across chains.'))
    .addSubcommand((sub) =>
      sub
        .setName('alert')
        .setDescription('Notify me when gas drops below a value (gwei).')
        .addStringOption((opt) =>
          opt.setName('chain').setDescription('Chain').setRequired(true).addChoices(...chainChoices),
        )
        .addNumberOption((opt) =>
          opt.setName('gwei').setDescription('Alert when gas ≤ this many gwei').setRequired(true),
        ),
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'show') {
      await interaction.deferReply();
      const snapshots = await gasService.getAllGas();
      await interaction.editReply({ embeds: [gasEmbed(snapshots)] });
      return;
    }

    // sub === 'alert'
    await interaction.deferReply({ ephemeral: true });
    await userService.ensure(interaction.user.id, interaction.user.username);
    const chain = asChain(interaction.options.getString('chain', true));
    const gwei = interaction.options.getNumber('gwei', true);
    await alertService.create({
      userId: interaction.user.id,
      type: AlertType.GAS_BELOW,
      asset: chain,
      threshold: gwei,
      comparator: '<',
    });
    await interaction.editReply({
      embeds: [successEmbed('Gas alert set', `I'll DM you when ${chain} gas drops to **${gwei} gwei** or lower.`)],
    });
  },
};

export default command;
