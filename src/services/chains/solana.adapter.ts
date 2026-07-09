/**
 * Solana adapter using the public JSON-RPC endpoint.
 *
 * Solana's model differs from EVM/UTXO chains, so we implement just enough to
 * detect new signatures (activity) and native SOL balance. Full SPL-token
 * decoding is intentionally left as an extension point.
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

const log = createLogger('SolanaAdapter');

const LAMPORTS = 1_000_000_000;

interface RpcResponse<T> {
  result: T;
  error?: { message: string };
}

interface SignatureInfo {
  signature: string;
  slot: number;
  blockTime: number | null;
  err: unknown | null;
}

export class SolanaAdapter implements IChainAdapter {
  public readonly chain = Chain.SOLANA;
  private readonly http: AxiosInstance;

  constructor() {
    this.http = createHttpClient({ provider: 'solana-rpc', timeoutMs: 12_000 });
  }

  isConfigured(): boolean {
    return Boolean(env.SOLANA_RPC_URL);
  }

  normalizeAddress(address: string): string {
    return validateAddress(this.chain, address);
  }

  /** Perform a JSON-RPC call against the configured endpoint. */
  private async rpc<T>(method: string, params: unknown[]): Promise<T> {
    const { data } = await this.http.post<RpcResponse<T>>(env.SOLANA_RPC_URL, {
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    });
    if (data.error) throw new Error(data.error.message);
    return data.result;
  }

  async getNativeBalance(address: string): Promise<number | null> {
    try {
      const res = await this.rpc<{ value: number }>('getBalance', [address]);
      return res.value / LAMPORTS;
    } catch (error) {
      log.debug('getNativeBalance failed', { message: (error as Error).message });
      return null;
    }
  }

  async getAddressActivity(address: string, cursor?: string | null): Promise<AddressActivity> {
    const sigs = await this.rpc<SignatureInfo[]>('getSignaturesForAddress', [
      address,
      { limit: 25, ...(cursor ? { until: cursor } : {}) },
    ]);

    const txs: NormalizedTransaction[] = sigs.map((s) => ({
      chain: this.chain,
      hash: s.signature,
      blockNumber: BigInt(s.slot),
      direction: TransactionDirection.UNKNOWN, // requires tx parse to attribute
      kind: s.err ? TransactionKind.FAILED : TransactionKind.NATIVE_TRANSFER,
      assetSymbol: CHAINS[this.chain].symbol,
      confirmed: true,
      timestamp: s.blockTime ? new Date(s.blockTime * 1000) : new Date(),
    }));

    return { transactions: txs, cursor: sigs[0]?.signature ?? cursor ?? undefined };
  }
}
