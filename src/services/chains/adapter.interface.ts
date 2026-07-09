/**
 * Chain adapter contract.
 *
 * Every supported blockchain implements `IChainAdapter`. This is the seam that
 * makes "design the code so more chains can be added easily" real: the rest of
 * the bot depends only on this interface, never on a specific chain's API.
 */
import { Chain } from '@prisma/client';
import { NormalizedTransaction, ContractRiskReport } from '../../types';

export interface AddressActivity {
  /** Newly observed transactions (newest first). */
  transactions: NormalizedTransaction[];
  /** Opaque cursor to persist and pass back on the next poll. */
  cursor?: string;
}

export interface IChainAdapter {
  readonly chain: Chain;

  /** Whether the adapter has the credentials/config it needs to run live. */
  isConfigured(): boolean;

  /** Validate & normalize an address for this chain (throws on invalid). */
  normalizeAddress(address: string): string;

  /**
   * Fetch recent activity for an address since `cursor`. Adapters should return
   * an empty list (not throw) when there is simply nothing new.
   */
  getAddressActivity(address: string, cursor?: string | null): Promise<AddressActivity>;

  /** Native-asset balance for an address (in whole units), or null if unknown. */
  getNativeBalance(address: string): Promise<number | null>;

  /**
   * Optional: inspect a smart contract's public metadata for the risk scanner.
   * Non-EVM / unsupported chains may leave this undefined.
   */
  scanContract?(address: string): Promise<ContractRiskReport>;
}
