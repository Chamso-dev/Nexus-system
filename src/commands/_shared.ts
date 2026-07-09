/**
 * Shared helpers for command modules (ignored by the loader — leading `_`).
 * Keeps option definitions DRY, e.g. the chain choice list used by several
 * commands.
 */
import { Chain } from '@prisma/client';
import { CHAINS } from '../config/constants';

/** Choice list for a `chain` string option, generated from chain metadata. */
export const chainChoices = (Object.keys(CHAINS) as Chain[]).map((chain) => ({
  name: `${CHAINS[chain].name} (${CHAINS[chain].symbol})`,
  value: chain,
}));

/** Parse a chain option value back into the enum (already validated by choices). */
export function asChain(value: string): Chain {
  return value as Chain;
}
