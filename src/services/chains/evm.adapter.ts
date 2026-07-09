/**
 * EVM chain adapter.
 *
 * A single implementation serves every EVM-compatible chain (Ethereum, BNB,
 * Polygon, Arbitrum, Optimism, Base, Avalanche) because they all expose the
 * Etherscan-compatible REST API. Chain-specific differences (base URL, API key)
 * are injected at construction time — this is the "add a chain in minutes"
 * design goal in action.
 */
import { Chain, TransactionDirection, TransactionKind } from '@prisma/client';
import { AxiosInstance } from 'axios';
import { IChainAdapter, AddressActivity } from './adapter.interface';
import { ContractRiskReport, NormalizedTransaction } from '../../types';
import { CHAINS, RISK_DISCLAIMER } from '../../config/constants';
import { createHttpClient } from '../../utils/http';
import { validateAddress } from '../../utils/validation';
import { createLogger } from '../../utils/logger';

const log = createLogger('EvmAdapter');

/** Explorer API base URLs keyed by chain. */
const EXPLORER_API: Partial<Record<Chain, string>> = {
  ETHEREUM: 'https://api.etherscan.io/api',
  BNB: 'https://api.bscscan.com/api',
  POLYGON: 'https://api.polygonscan.com/api',
  ARBITRUM: 'https://api.arbiscan.io/api',
  OPTIMISM: 'https://api-optimistic.etherscan.io/api',
  BASE: 'https://api.basescan.org/api',
  AVALANCHE: 'https://api.snowtrace.io/api',
};

/** Raw shapes returned by the Etherscan-family `txlist`/`tokentx` endpoints. */
interface EtherscanTx {
  hash: string;
  blockNumber: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  isError?: string;
  tokenSymbol?: string;
  tokenDecimal?: string;
  contractAddress?: string;
}

export class EvmAdapter implements IChainAdapter {
  public readonly chain: Chain;
  private readonly http: AxiosInstance;
  private readonly apiKey: string;

  constructor(chain: Chain, apiKey: string) {
    this.chain = chain;
    this.apiKey = apiKey;
    this.http = createHttpClient({
      baseURL: EXPLORER_API[chain],
      provider: `${chain}-explorer`,
      timeoutMs: 12_000,
    });
  }

  isConfigured(): boolean {
    // Explorers allow keyless requests at a low rate; we still work without a
    // key but strongly recommend configuring one for production throughput.
    return Boolean(EXPLORER_API[this.chain]);
  }

  normalizeAddress(address: string): string {
    return validateAddress(this.chain, address);
  }

  /** Shared query helper that injects module params + api key. */
  private async query<T>(params: Record<string, string | number>): Promise<T> {
    const { data } = await this.http.get('', {
      params: { ...params, apikey: this.apiKey || undefined },
    });
    return data as T;
  }

  async getNativeBalance(address: string): Promise<number | null> {
    try {
      const res = await this.query<{ status: string; result: string }>({
        module: 'account',
        action: 'balance',
        address,
        tag: 'latest',
      });
      if (res.status !== '1') return null;
      return Number(res.result) / 10 ** CHAINS[this.chain].decimals;
    } catch (error) {
      log.debug('getNativeBalance failed', { chain: this.chain, message: (error as Error).message });
      return null;
    }
  }

  async getAddressActivity(address: string, cursor?: string | null): Promise<AddressActivity> {
    const startBlock = cursor ? Number(cursor) + 1 : 0;
    const lower = address.toLowerCase();

    // Fetch native transfers and ERC-20 token transfers in parallel.
    const [native, tokens] = await Promise.all([
      this.query<{ status: string; result: EtherscanTx[] | string }>({
        module: 'account',
        action: 'txlist',
        address,
        startblock: startBlock,
        endblock: 99999999,
        sort: 'desc',
        page: 1,
        offset: 25,
      }).catch(() => ({ status: '0', result: [] as EtherscanTx[] })),
      this.query<{ status: string; result: EtherscanTx[] | string }>({
        module: 'account',
        action: 'tokentx',
        address,
        startblock: startBlock,
        endblock: 99999999,
        sort: 'desc',
        page: 1,
        offset: 25,
      }).catch(() => ({ status: '0', result: [] as EtherscanTx[] })),
    ]);

    const txs: NormalizedTransaction[] = [];
    let maxBlock = cursor ? Number(cursor) : 0;

    const pushTx = (raw: EtherscanTx, kind: TransactionKind, symbol: string, decimals: number) => {
      const block = Number(raw.blockNumber);
      maxBlock = Math.max(maxBlock, block);
      const isOut = raw.from?.toLowerCase() === lower;
      const isIn = raw.to?.toLowerCase() === lower;
      txs.push({
        chain: this.chain,
        hash: raw.hash,
        blockNumber: BigInt(block),
        direction:
          isOut && isIn
            ? TransactionDirection.SELF
            : isOut
              ? TransactionDirection.OUT
              : isIn
                ? TransactionDirection.IN
                : TransactionDirection.UNKNOWN,
        kind: raw.isError === '1' ? TransactionKind.FAILED : kind,
        from: raw.from,
        to: raw.to,
        assetSymbol: symbol,
        amount: Number(raw.value) / 10 ** decimals,
        confirmed: true,
        timestamp: new Date(Number(raw.timeStamp) * 1000),
      });
    };

    if (Array.isArray(native.result)) {
      for (const raw of native.result) {
        pushTx(raw, TransactionKind.NATIVE_TRANSFER, CHAINS[this.chain].symbol, CHAINS[this.chain].decimals);
      }
    }
    if (Array.isArray(tokens.result)) {
      for (const raw of tokens.result) {
        pushTx(
          raw,
          TransactionKind.TOKEN_TRANSFER,
          raw.tokenSymbol || 'TOKEN',
          Number(raw.tokenDecimal ?? 18),
        );
      }
    }

    // Newest first.
    txs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return { transactions: txs, cursor: String(maxBlock) };
  }

  async scanContract(address: string): Promise<ContractRiskReport> {
    const normalized = this.normalizeAddress(address);
    const notes: string[] = [];

    interface SourceResult {
      SourceCode: string;
      ABI: string;
      ContractName: string;
      Proxy: string;
      Implementation: string;
    }

    const res = await this.query<{ status: string; result: SourceResult[] }>({
      module: 'contract',
      action: 'getsourcecode',
      address: normalized,
    });

    const info = Array.isArray(res.result) ? res.result[0] : undefined;
    const verified = Boolean(info && info.ABI && info.ABI !== 'Contract source code not verified');
    const source = (info?.SourceCode ?? '').toLowerCase();
    const abi = (info?.ABI ?? '').toLowerCase();
    const haystack = `${source} ${abi}`;

    const has = (needle: string) => (verified ? haystack.includes(needle) : null);
    const isProxy = info?.Proxy === '1';
    const hasMint = has('function mint') ?? has('"name":"mint"');
    const hasPause = has('function pause') ?? has('"name":"pause"');
    const hasBlacklist =
      has('blacklist') ?? has('blocklist') ?? has('denylist');

    if (!verified) notes.push('Source code is NOT verified on the block explorer.');
    if (isProxy) notes.push('Contract is an upgradeable proxy — logic can change.');
    if (hasMint) notes.push('Contract appears to expose a mint function.');
    if (hasPause) notes.push('Contract appears to expose a pause function.');
    if (hasBlacklist) notes.push('Contract appears to have blacklist/denylist capability.');
    notes.push(RISK_DISCLAIMER);

    // Simple additive risk model.
    let riskScore = 0;
    if (!verified) riskScore += 40;
    if (isProxy) riskScore += 20;
    if (hasMint) riskScore += 15;
    if (hasPause) riskScore += 10;
    if (hasBlacklist) riskScore += 15;
    riskScore = Math.min(100, riskScore);

    const riskLabel: ContractRiskReport['riskLabel'] =
      !verified && riskScore >= 40
        ? 'HIGH'
        : riskScore >= 50
          ? 'HIGH'
          : riskScore >= 25
            ? 'MEDIUM'
            : 'LOW';

    return {
      chain: this.chain,
      address: normalized,
      verified,
      ownerRenounced: null, // requires reading owner() state — out of scope for metadata-only scan
      isProxy: verified ? isProxy : null,
      hasMint,
      hasPause,
      hasBlacklist,
      auditLinks: [],
      liquidityUsd: null,
      riskScore,
      riskLabel,
      notes,
    };
  }
}
