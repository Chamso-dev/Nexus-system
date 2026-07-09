/**
 * Bitcoin adapter using a public Esplora-compatible REST API
 * (blockstream.info / mempool.space). No API key required.
 */
import { Chain, TransactionDirection, TransactionKind } from '@prisma/client';
import { AxiosInstance } from 'axios';
import { IChainAdapter, AddressActivity } from './adapter.interface';
import { NormalizedTransaction } from '../../types';
import { CHAINS } from '../../config/constants';
import { createHttpClient } from '../../utils/http';
import { validateAddress } from '../../utils/validation';
import { env } from '../../config/env';
import { createLogger } from '../../utils/logger';

const log = createLogger('BitcoinAdapter');

/** Esplora transaction shape (trimmed to what we use). */
interface EsploraVin {
  prevout?: { scriptpubkey_address?: string; value?: number };
}
interface EsploraVout {
  scriptpubkey_address?: string;
  value: number;
}
interface EsploraTx {
  txid: string;
  status: { confirmed: boolean; block_height?: number; block_time?: number };
  vin: EsploraVin[];
  vout: EsploraVout[];
}

const SATS = 100_000_000;

export class BitcoinAdapter implements IChainAdapter {
  public readonly chain = Chain.BITCOIN;
  private readonly http: AxiosInstance;

  constructor() {
    this.http = createHttpClient({
      baseURL: env.BITCOIN_API_BASE_URL,
      provider: 'bitcoin-esplora',
      timeoutMs: 12_000,
    });
  }

  isConfigured(): boolean {
    return Boolean(env.BITCOIN_API_BASE_URL);
  }

  normalizeAddress(address: string): string {
    return validateAddress(this.chain, address);
  }

  async getNativeBalance(address: string): Promise<number | null> {
    try {
      const { data } = await this.http.get<{
        chain_stats: { funded_txo_sum: number; spent_txo_sum: number };
      }>(`/address/${address}`);
      const stats = data.chain_stats;
      return (stats.funded_txo_sum - stats.spent_txo_sum) / SATS;
    } catch (error) {
      log.debug('getNativeBalance failed', { message: (error as Error).message });
      return null;
    }
  }

  async getAddressActivity(address: string, cursor?: string | null): Promise<AddressActivity> {
    const { data } = await this.http.get<EsploraTx[]>(`/address/${address}/txs`);
    const txs: NormalizedTransaction[] = [];
    let newestSeen = cursor ?? undefined;

    for (const tx of data) {
      // Stop once we reach the last-seen txid (cursor is the newest processed).
      if (cursor && tx.txid === cursor) break;
      if (!newestSeen) newestSeen = tx.txid;

      const inputsFromAddr = tx.vin.some((v) => v.prevout?.scriptpubkey_address === address);
      const outputsToAddr = tx.vout.filter((v) => v.scriptpubkey_address === address);
      const received = outputsToAddr.reduce((sum, v) => sum + v.value, 0) / SATS;
      const direction = inputsFromAddr
        ? TransactionDirection.OUT
        : received > 0
          ? TransactionDirection.IN
          : TransactionDirection.UNKNOWN;

      txs.push({
        chain: this.chain,
        hash: tx.txid,
        blockNumber: tx.status.block_height ? BigInt(tx.status.block_height) : undefined,
        direction,
        kind: TransactionKind.NATIVE_TRANSFER,
        assetSymbol: CHAINS[this.chain].symbol,
        amount: received || undefined,
        confirmed: tx.status.confirmed,
        timestamp: tx.status.block_time ? new Date(tx.status.block_time * 1000) : new Date(),
      });
    }

    // The first item in the list is the newest — persist it as the next cursor.
    const nextCursor = data[0]?.txid ?? cursor ?? undefined;
    return { transactions: txs, cursor: nextCursor };
  }
}
