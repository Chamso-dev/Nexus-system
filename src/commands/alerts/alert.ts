/**
 * /alert — price & movement alerts (create / list / delete).
 * Alerts are evaluated every minute by the scheduler and delivered via DM.
 */
import { SlashCommandBuilder } from 'discord.js';
import { AlertType } from '@prisma/client';
import type { Command } from '../../types/discord';
import { alertService } from '../../services/alert.service';
import { priceService } from '../../services/price.service';
import { userService } from '../../services/user.service';
import { successEmbed, infoEmbed, errorEmbed } from '../../utils/embeds';
import { formatUsd } from '../../utils/format';

const command: Command = {
  category: 'Alerts',
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('alert')
    .setDescription('Create and manage price alerts.')
    .addSubcommand((sub) =>
      sub
        .setName('price')
        .setDescription('Alert when an asset crosses a price.')
        .addStringOption((o) =>
          o.setName('asset').setDescription('Asset (e.g. bitcoin)').setRequired(true).setAutocomplete(true),
        )
        .addStringOption((o) =>
          o
            .setName('direction')
            .setDescription('Above or below the target')
            .setRequired(true)
            .addChoices({ name: 'above', value: 'above' }, { name: 'below', value: 'below' }),
        )
        .addNumberOption((o) => o.setName('target').setDescription('Target price in USD').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('move')
        .setDescription('Alert on a 24H percentage move.')
        .addStringOption((o) =>
          o.setName('asset').setDescription('Asset (e.g. ethereum)').setRequired(true).setAutocomplete(true),
        )
        .addNumberOption((o) =>
          o.setName('percent').setDescription('Absolute % move to trigger on').setRequired(true),
        ),
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List your active alerts.'))
    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('Delete an alert.')
        .addStringOption((o) =>
          o.setName('alert').setDescription('Which alert').setRequired(true).setAutocomplete(true),
        ),
    ),
  async execute(interaction) {
    await userService.ensure(interaction.user.id, interaction.user.username);
    const sub = interaction.options.getSubcommand();

    if (sub === 'price') {
      await interaction.deferReply({ ephemeral: true });
      const asset = interaction.options.getString('asset', true);
      const direction = interaction.options.getString('direction', true);
      const target = interaction.options.getNumber('target', true);
      const quote = await priceService.getQuote(asset);
      if (!quote) {
        await interaction.editReply({ embeds: [errorEmbed('Unknown asset', `No data for \`${asset}\`.`)] });
        return;
      }
      await alertService.create({
        userId: interaction.user.id,
        type: direction === 'above' ? AlertType.PRICE_ABOVE : AlertType.PRICE_BELOW,
        asset,
        threshold: target,
        comparator: direction === 'above' ? '>' : '<',
      });
      await interaction.editReply({
        embeds: [
          successEmbed(
            'Price alert created',
            `I'll DM you when **${quote.symbol}** goes **${direction} ${formatUsd(target)}**.\n` +
              `Current: ${formatUsd(quote.usd)}`,
          ),
        ],
      });
      return;
    }

    if (sub === 'move') {
      await interaction.deferReply({ ephemeral: true });
      const asset = interaction.options.getString('asset', true);
      const percent = interaction.options.getNumber('percent', true);
      await alertService.create({
        userId: interaction.user.id,
        type: AlertType.PERCENT_MOVE,
        asset,
        threshold: Math.abs(percent),
        comparator: '%',
      });
      await interaction.editReply({
        embeds: [successEmbed('Movement alert created', `Triggers on a ±${Math.abs(percent)}% 24H move.`)],
      });
      return;
    }

    if (sub === 'list') {
      await interaction.deferReply({ ephemeral: true });
      const alerts = await alertService.list(interaction.user.id);
      const embed = infoEmbed(
        `Your alerts (${alerts.length})`,
        alerts.length
          ? alerts
              .map(
                (a) =>
                  `• **${a.type}** ${a.asset ?? ''} ${a.comparator ?? ''} ` +
                  `${a.threshold ? formatUsd(Number(a.threshold)) : ''} — \`${a.status}\``,
              )
              .join('\n')
          : 'No alerts yet. Create one with `/alert price`.',
      );
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'delete') {
      await interaction.deferReply({ ephemeral: true });
      await alertService.delete(interaction.user.id, interaction.options.getString('alert', true));
      await interaction.editReply({ embeds: [successEmbed('Alert deleted')] });
      return;
    }
  },
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name === 'asset') {
      const results = await priceService.search(focused.value);
      await interaction.respond(
        results.slice(0, 25).map((r) => ({ name: `${r.name} (${r.symbol.toUpperCase()})`, value: r.id })),
      );
      return;
    }
    if (focused.name === 'alert') {
      const alerts = await alertService.list(interaction.user.id);
      await interaction.respond(
        alerts
          .slice(0, 25)
          .map((a) => ({
            name: `${a.type} ${a.asset ?? ''} ${a.threshold ? Number(a.threshold) : ''}`.trim(),
            value: a.id,
          })),
      );
    }
  },
};

export default command;
