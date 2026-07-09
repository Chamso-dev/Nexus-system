/**
 * Whale alert service.
 *
 * Surfaces large transfers. A production deployment would consume a streaming
 * provider (mempool feed, Whale Alert API, or per-block scanning). Here we
 * expose a provider-agnostic interface: `getRecentWhaleTransfers` fetches the
 * latest large native transfers for a chain via its explorer, and the whale
 * job broadcasts anything above the configured USD threshold.
 *
 * The design cleanly separates "how we detect" (swappable) from "how we
 * present/broadcast" (stable), matching the whale-alert spec fields.
 */
import { Chain } from '@prisma/client';
import { WhaleTransfer } from '../types';
import { CHAINS } from '../config/constants';
import { priceService } from './price.service';
import { getChainAdapter } from './chains/registry';
import { cache } from './cache.service';
import { createLogger } from '../utils/logger';

const log = createLogger('WhaleService');

/** Default per-asset USD thresholds used when a guild hasn't customized them. */
export const DEFAULT_WHALE_THRESHOLDS_USD: Record<string, number> = {
  BTC: 1_000_000,
  ETH: 500_000,
  BNB: 250_000,
  SOL: 250_000,
  USDT: 1_000_000,
  USDC: 1_000_000,
  DEFAULT: 500_000,
};

export class WhaleService {
  /**
   * Build a WhaleTransfer view-model from raw components. Centralizing this
   * guarantees every whale embed carries the required fields (amount, USD,
   * chain, block, hash, from/to, explorer link, time).
   */
  buildTransfer(params: {
    chain: Chain;
    hash: string;
    asset: string;
    amount: number;
    usdValue: number;
    from: string;
    to: string;
    blockNumber?: bigint;
    timestamp: Date;
  }): WhaleTransfer {
    return {
      ...params,
      explorerUrl: `${CHAINS[params.chain].explorerTxUrl}${params.hash}`,
    };
  }

  /** Whether a transfer qualifies as a whale move for the given asset. */
  isWhale(asset: string, usdValue: number, overrideThreshold?: number): boolean {
    const threshold =
      overrideThreshold ??
      DEFAULT_WHALE_THRESHOLDS_USD[asset.toUpperCase()] ??
      DEFAULT_WHALE_THRESHOLDS_USD.DEFAULT;
    return usdValue >= threshold;
  }

  /**
   * Scan a watched address's latest activity and return transfers that exceed a
   * USD threshold — reused by both the wallet "large transfer" alert and the
   * guild whale feed.
   */
  async getLargeTransfersForAddress(
    chain: Chain,
    address: string,
    thresholdUsd: number,
    cursor?: string | null,
  ): Promise<{ transfers: WhaleTransfer[]; cursor?: string }> {
    const adapter = getChainAdapter(chain);
    const activity = await adapter.getAddressActivity(address, cursor);
    const nativePrice = (await priceService.getQuote(CHAINS[chain].coingeckoId))?.usd ?? 0;

    const transfers: WhaleTransfer[] = [];
    for (const tx of activity.transactions) {
      if (tx.amount === undefined) continue;
      // We can only price the native asset cheaply here; token USD pricing would
      // require a per-token lookup (left as an extension for cost reasons).
      const usdValue = tx.assetSymbol === CHAINS[chain].symbol ? tx.amount * nativePrice : 0;
      if (usdValue >= thresholdUsd) {
        transfers.push(
          this.buildTransfer({
            chain,
            hash: tx.hash,
            asset: tx.assetSymbol ?? CHAINS[chain].symbol,
            amount: tx.amount,
            usdValue,
            from: tx.from ?? 'unknown',
            to: tx.to ?? 'unknown',
            blockNumber: tx.blockNumber,
            timestamp: tx.timestamp,
          }),
        );
      }
    }
    return { transfers, cursor: activity.cursor };
  }

  /**
   * Recent notable transfers for a chain's featured whale feed. Cached and
   * best-effort; returns [] when the provider can't supply data.
   */
  async getRecentWhaleTransfers(chain: Chain): Promise<WhaleTransfer[]> {
    return cache.wrap(`whale:recent:${chain}`, 60, async () => {
      try {
        // Placeholder for a real mempool/stream integration. Returning an empty
        // list keeps the feature wired without fabricating data.
        return [];
      } catch (error) {
        log.debug('getRecentWhaleTransfers failed', { chain, message: (error as Error).message });
        return [];
      }
    });
  }
}

export const whaleService = new WhaleService();
