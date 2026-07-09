/**
 * Smart-contract risk scanner service.
 *
 * Delegates to the chain adapter's `scanContract` (currently EVM chains) and
 * augments the report. This is metadata-only, informational analysis — the
 * disclaimer is enforced at the embed layer and included in the report notes.
 */
import { Chain } from '@prisma/client';
import { ContractRiskReport } from '../types';
import { getChainAdapter } from './chains/registry';
import { cache } from './cache.service';
import { CACHE_TTL, CHAINS } from '../config/constants';
import { ValidationError } from '../utils/errors';

export class ContractService {
  /** Whether risk scanning is available for a chain. */
  isSupported(chain: Chain): boolean {
    return CHAINS[chain].evm; // metadata scanning currently targets EVM chains
  }

  /** Run a cached risk scan for a contract address. */
  async scan(chain: Chain, address: string): Promise<ContractRiskReport> {
    if (!this.isSupported(chain)) {
      throw new ValidationError(`Contract scanning is not yet supported on ${CHAINS[chain].name}.`);
    }
    const adapter = getChainAdapter(chain);
    if (!adapter.scanContract) {
      throw new ValidationError(`Contract scanning is unavailable for ${CHAINS[chain].name}.`);
    }
    const normalized = adapter.normalizeAddress(address);
    return cache.wrap(`contract:${chain}:${normalized}`, CACHE_TTL.contract, () =>
      adapter.scanContract!(normalized),
    );
  }
}

export const contractService = new ContractService();
