/**
 * Gas tracker service.
 *
 * Reads the Etherscan-family "gas oracle" endpoint for supported EVM chains and
 * normalizes it to a `GasSnapshot` (low / average / high gwei). Results are
 * cached briefly since gas moves fast but the endpoints are rate-limited.
 */
import { Chain } from '@prisma/client';
import { AxiosInstance } from 'axios';
import { createHttpClient } from '../utils/http';
import { cache } from './cache.service';
import { CACHE_TTL } from '../config/constants';
import { GasSnapshot } from '../types';
import { env } from '../config/env';
import { createLogger } from '../utils/logger';

const log = createLogger('GasService');

/** Chains that expose an Etherscan-compatible gas oracle + their API config. */
const GAS_SOURCES: Partial<Record<Chain, { url: string; key: string }>> = {
  ETHEREUM: { url: 'https://api.etherscan.io/api', key: env.ETHERSCAN_API_KEY },
  POLYGON: { url: 'https://api.polygonscan.com/api', key: env.POLYGONSCAN_API_KEY },
  ARBITRUM: { url: 'https://api.arbiscan.io/api', key: env.ARBISCAN_API_KEY },
  OPTIMISM: { url: 'https://api-optimistic.etherscan.io/api', key: env.OPTIMISM_ETHERSCAN_API_KEY },
  BASE: { url: 'https://api.basescan.org/api', key: env.BASESCAN_API_KEY },
};

interface GasOracleResult {
  status: string;
  result: {
    SafeGasPrice: string;
    ProposeGasPrice: string;
    FastGasPrice: string;
    suggestBaseFee?: string;
  };
}

export class GasService {
  private clients = new Map<Chain, AxiosInstance>();

  private client(chain: Chain): AxiosInstance {
    const cached = this.clients.get(chain);
    if (cached) return cached;
    const source = GAS_SOURCES[chain]!;
    const client = createHttpClient({ baseURL: source.url, provider: `${chain}-gas`, timeoutMs: 8_000 });
    this.clients.set(chain, client);
    return client;
  }

  /** Chains for which gas data is available. */
  supportedChains(): Chain[] {
    return Object.keys(GAS_SOURCES) as Chain[];
  }

  /** Gas snapshot for a single chain (cached). */
  async getGas(chain: Chain): Promise<GasSnapshot | null> {
    if (!GAS_SOURCES[chain]) return null;
    return cache.wrap(`gas:${chain}`, CACHE_TTL.gas, async () => {
      try {
        const source = GAS_SOURCES[chain]!;
        const { data } = await this.client(chain).get<GasOracleResult>('', {
          params: { module: 'gastracker', action: 'gasoracle', apikey: source.key || undefined },
        });
        if (data.status !== '1') return null;
        const r = data.result;
        return {
          chain,
          low: Number(r.SafeGasPrice),
          average: Number(r.ProposeGasPrice),
          high: Number(r.FastGasPrice),
          baseFee: r.suggestBaseFee ? Number(r.suggestBaseFee) : null,
          updatedAt: new Date(),
        } satisfies GasSnapshot;
      } catch (error) {
        log.debug('getGas failed', { chain, message: (error as Error).message });
        return null;
      }
    });
  }

  /** Gas snapshots for every supported chain (nulls filtered out). */
  async getAllGas(): Promise<GasSnapshot[]> {
    const results = await Promise.all(this.supportedChains().map((c) => this.getGas(c)));
    return results.filter((r): r is GasSnapshot => r !== null);
  }
}

export const gasService = new GasService();
