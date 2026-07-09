/**
 * Wallet watch job.
 *
 * For each active wallet: fetch new activity since the last cursor, persist new
 * transactions, and DM the owner about notable events (received / sent / NFT /
 * large transfer / failed / confirmation). The first scan only establishes a
 * cursor (no backfill spam); subsequent scans notify on genuinely new activity.
 */
import { Chain, TransactionDirection, TransactionKind } from '@prisma/client';
import { Job } from './job.interface';
import { walletRepository } from '../database/repositories/wallet.repository';
import { getChainAdapter } from '../services/chains/registry';
import { priceService } from '../services/price.service';
import { notificationService } from '../services/notification.service';
import { userService } from '../services/user.service';
import { baseEmbed } from '../utils/embeds';
import { CHAINS, COLORS, EMOJI } from '../config/constants';
import { formatAmount, formatUsd, shortenAddress, discordTimestamp } from '../utils/format';
import { NormalizedTransaction } from '../types';
import { createLogger } from '../utils/logger';

const log = createLogger('WalletWatchJob');

/** Human label + color for a transaction event. */
function describe(tx: NormalizedTransaction): { title: string; color: number } {
  if (tx.kind === TransactionKind.FAILED) return { title: 'Failed transaction', color: COLORS.danger };
  if (tx.kind === TransactionKind.NFT_TRANSFER) return { title: 'NFT transfer', color: COLORS.info };
  if (tx.direction === TransactionDirection.IN)
    return { title: `${EMOJI.check} Tokens received`, color: COLORS.success };
  if (tx.direction === TransactionDirection.OUT)
    return { title: '📤 Tokens sent', color: COLORS.warning };
  return { title: 'Wallet activity', color: COLORS.neutral };
}

export const walletWatchJob: Job = {
  name: 'wallet-watch',
  maxRetries: 1,
  backoffMs: 2000,
  async run() {
    const wallets = await walletRepository.findActiveForScan(150);
    if (!wallets.length) return 'no wallets to scan';

    let notified = 0;
    for (const wallet of wallets) {
      try {
        const adapter = getChainAdapter(wallet.chain);
        const { transactions, cursor } = await adapter.getAddressActivity(
          wallet.address,
          wallet.lastCursor,
        );

        // Persist new transactions (dedup handled by the DB unique constraint).
        await walletRepository.recordTransactions(
          wallet.id,
          transactions.map((tx) => ({
            walletId: wallet.id,
            chain: tx.chain,
            hash: tx.hash,
            blockNumber: tx.blockNumber ?? null,
            direction: tx.direction,
            kind: tx.kind,
            fromAddress: tx.from ?? null,
            toAddress: tx.to ?? null,
            assetSymbol: tx.assetSymbol ?? null,
            amount: tx.amount ?? null,
            usdValue: tx.usdValue ?? null,
            confirmed: tx.confirmed,
            timestamp: tx.timestamp,
          })),
        );

        // Only notify after the first scan established a baseline cursor.
        const isFirstScan = !wallet.lastCursor;
        await walletRepository.update(wallet.id, { lastCheckedAt: new Date(), lastCursor: cursor });
        if (isFirstScan || !transactions.length) continue;

        const settings = await userService.getSettings(wallet.userId);
        if (settings && !settings.dmAlerts) continue;

        // Price the native asset for USD context / large-transfer detection.
        const nativePrice = (await priceService.getQuote(CHAINS[wallet.chain].coingeckoId))?.usd ?? 0;
        const threshold = Number(wallet.alertThreshold);

        // Notify on up to 3 newest events to avoid floods.
        for (const tx of transactions.slice(0, 3)) {
          const usd = tx.assetSymbol === CHAINS[wallet.chain].symbol ? (tx.amount ?? 0) * nativePrice : 0;
          const isLarge = threshold > 0 && usd >= threshold;
          const { title, color } = describe(tx);
          const label = wallet.label ?? shortenAddress(wallet.address);

          const embed = baseEmbed()
            .setColor(isLarge ? COLORS.gold : color)
            .setTitle(`${isLarge ? EMOJI.whale + ' Large ' : ''}${title}`)
            .setDescription(`Wallet **${label}** on ${CHAINS[wallet.chain].name}`)
            .addFields(
              { name: 'Amount', value: formatAmount(tx.amount, tx.assetSymbol), inline: true },
              { name: 'USD', value: usd ? formatUsd(usd) : 'N/A', inline: true },
              { name: 'Time', value: discordTimestamp(tx.timestamp), inline: true },
              {
                name: 'Transaction',
                value: `[View](${CHAINS[wallet.chain].explorerTxUrl}${tx.hash})`,
              },
            );

          await notificationService.dmUser(wallet.userId, embed);
          notified += 1;
        }
      } catch (error) {
        log.debug('Wallet scan failed', {
          wallet: wallet.id,
          chain: wallet.chain,
          message: (error as Error).message,
        });
      }
    }

    return `scanned ${wallets.length}, notified ${notified}`;
  },
};

/** Re-exported for type-only consumers/tests. */
export const _chainSymbol = (chain: Chain): string => CHAINS[chain].symbol;
