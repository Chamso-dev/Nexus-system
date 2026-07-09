/**
 * Chain adapter registry.
 *
 * Wires each `Chain` to its adapter instance. Consumers ask the registry for an
 * adapter by chain rather than constructing adapters themselves. Adding a chain
 * means adding one line here (plus the enum + metadata entry).
 */
import { Chain } from '@prisma/client';
import { IChainAdapter } from './adapter.interface';
import { EvmAdapter } from './evm.adapter';
import { BitcoinAdapter } from './bitcoin.adapter';
import { SolanaAdapter } from './solana.adapter';
import { env } from '../../config/env';
import { NotFoundError } from '../../utils/errors';

/** Lazily-instantiated singleton adapters keyed by chain. */
const adapters: Record<Chain, IChainAdapter> = {
  BITCOIN: new BitcoinAdapter(),
  SOLANA: new SolanaAdapter(),
  ETHEREUM: new EvmAdapter(Chain.ETHEREUM, env.ETHERSCAN_API_KEY),
  BNB: new EvmAdapter(Chain.BNB, env.BSCSCAN_API_KEY),
  POLYGON: new EvmAdapter(Chain.POLYGON, env.POLYGONSCAN_API_KEY),
  ARBITRUM: new EvmAdapter(Chain.ARBITRUM, env.ARBISCAN_API_KEY),
  OPTIMISM: new EvmAdapter(Chain.OPTIMISM, env.OPTIMISM_ETHERSCAN_API_KEY),
  BASE: new EvmAdapter(Chain.BASE, env.BASESCAN_API_KEY),
  AVALANCHE: new EvmAdapter(Chain.AVALANCHE, env.SNOWTRACE_API_KEY),
};

/** Get the adapter for a chain (throws if somehow unregistered). */
export function getChainAdapter(chain: Chain): IChainAdapter {
  const adapter = adapters[chain];
  if (!adapter) throw new NotFoundError(`No adapter registered for chain ${chain}`);
  return adapter;
}

/** List every registered chain. */
export function supportedChains(): Chain[] {
  return Object.keys(adapters) as Chain[];
}

/** List chains whose adapters are currently able to run live. */
export function configuredChains(): Chain[] {
  return supportedChains().filter((c) => adapters[c].isConfigured());
}
