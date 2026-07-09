/**
 * /wallet — manage watched wallets (add / remove / rename / list / threshold).
 *
 * Demonstrates: subcommands, choices, autocomplete (over the user's own
 * wallets), and per-user data ownership enforcement in the service layer.
 */
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/discord';
import { walletService } from '../../services/wallet.service';
import { userService } from '../../services/user.service';
import { walletRepository } from '../../database/repositories/wallet.repository';
import { successEmbed, infoEmbed } from '../../utils/embeds';
import { walletLine } from '../../utils/domainEmbeds';
import { formatUsd, shortenAddress } from '../../utils/format';
import { CHAINS } from '../../config/constants';
import { chainChoices, asChain } from '../_shared';

const command: Command = {
  category: 'Wallet',
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('wallet')
    .setDescription('Watch on-chain wallets and get transfer alerts.')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Start watching a wallet.')
        .addStringOption((o) =>
          o.setName('chain').setDescription('Blockchain').setRequired(true).addChoices(...chainChoices),
        )
        .addStringOption((o) => o.setName('address').setDescription('Wallet address').setRequired(true))
        .addStringOption((o) => o.setName('label').setDescription('A friendly name').setRequired(false))
        .addNumberOption((o) =>
          o
            .setName('threshold')
            .setDescription('USD value that counts as a "large transfer"')
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List your watched wallets.'))
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Stop watching a wallet.')
        .addStringOption((o) =>
          o.setName('wallet').setDescription('Which wallet').setRequired(true).setAutocomplete(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('rename')
        .setDescription('Rename a wallet.')
        .addStringOption((o) =>
          o.setName('wallet').setDescription('Which wallet').setRequired(true).setAutocomplete(true),
        )
        .addStringOption((o) => o.setName('label').setDescription('New name').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('threshold')
        .setDescription('Set the large-transfer USD threshold for a wallet.')
        .addStringOption((o) =>
          o.setName('wallet').setDescription('Which wallet').setRequired(true).setAutocomplete(true),
        )
        .addNumberOption((o) => o.setName('usd').setDescription('USD threshold').setRequired(true)),
    ),
  async execute(interaction) {
    await userService.ensure(interaction.user.id, interaction.user.username);
    const sub = interaction.options.getSubcommand();

    switch (sub) {
      case 'add': {
        await interaction.deferReply({ ephemeral: true });
        const chain = asChain(interaction.options.getString('chain', true));
        const address = interaction.options.getString('address', true);
        const label = interaction.options.getString('label') ?? undefined;
        const threshold = interaction.options.getNumber('threshold') ?? undefined;
        const wallet = await walletService.add(interaction.user.id, chain, address, label, threshold);
        const balance = await walletService.getBalance(chain, wallet.address);
        await interaction.editReply({
          embeds: [
            successEmbed(
              'Wallet added',
              `Now watching ${walletLine(chain, wallet.address, wallet.label)}` +
                (balance !== null
                  ? `\nBalance: **${balance.toFixed(4)} ${CHAINS[chain].symbol}**`
                  : ''),
            ),
          ],
        });
        return;
      }
      case 'list': {
        await interaction.deferReply({ ephemeral: true });
        const wallets = await walletService.list(interaction.user.id);
        const embed = infoEmbed(
          `${interaction.user.username}'s wallets (${wallets.length})`,
          wallets.length
            ? wallets
                .map(
                  (w) =>
                    `${walletLine(w.chain, w.address, w.label)}` +
                    (Number(w.alertThreshold) > 0
                      ? ` · alert ≥ ${formatUsd(Number(w.alertThreshold))}`
                      : ''),
                )
                .join('\n')
            : 'You are not watching any wallets. Use `/wallet add`.',
        );
        await interaction.editReply({ embeds: [embed] });
        return;
      }
      case 'remove': {
        await interaction.deferReply({ ephemeral: true });
        const wallet = await walletService.remove(
          interaction.user.id,
          interaction.options.getString('wallet', true),
        );
        await interaction.editReply({
          embeds: [successEmbed('Wallet removed', `Stopped watching \`${shortenAddress(wallet.address)}\`.`)],
        });
        return;
      }
      case 'rename': {
        await interaction.deferReply({ ephemeral: true });
        const wallet = await walletService.rename(
          interaction.user.id,
          interaction.options.getString('wallet', true),
          interaction.options.getString('label', true),
        );
        await interaction.editReply({
          embeds: [successEmbed('Wallet renamed', `Renamed to **${wallet.label}**.`)],
        });
        return;
      }
      case 'threshold': {
        await interaction.deferReply({ ephemeral: true });
        const wallet = await walletService.setThreshold(
          interaction.user.id,
          interaction.options.getString('wallet', true),
          interaction.options.getNumber('usd', true),
        );
        await interaction.editReply({
          embeds: [
            successEmbed(
              'Threshold updated',
              `Large-transfer alerts now trigger at ${formatUsd(Number(wallet.alertThreshold))}.`,
            ),
          ],
        });
        return;
      }
      default:
        return;
    }
  },
  async autocomplete(interaction) {
    // Suggest the user's own wallets for the `wallet` option.
    const focused = interaction.options.getFocused().toLowerCase();
    const wallets = await walletRepository.listByUser(interaction.user.id);
    const choices = wallets
      .map((w) => ({
        name: `${CHAINS[w.chain].symbol} ${w.label ?? shortenAddress(w.address)}`,
        value: w.id,
      }))
      .filter((c) => c.name.toLowerCase().includes(focused))
      .slice(0, 25);
    await interaction.respond(choices);
  },
};

export default command;
