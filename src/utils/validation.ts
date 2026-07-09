/**
 * Input validation & sanitization helpers.
 *
 * Address validation is chain-aware. We keep the checks intentionally
 * lightweight (format-level) — full checksum validation for every chain is out
 * of scope, but these guards stop obviously malformed input and injection.
 */
import { Chain } from '@prisma/client';
import { z } from 'zod';
import { ValidationError } from './errors';
import { CHAINS } from '../config/constants';

/** EVM 0x-prefixed 20-byte address. */
const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
/** Base58 Solana address (32-44 chars). */
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
/** Broad Bitcoin address matcher (legacy, P2SH, bech32). */
const BTC_ADDRESS = /^(bc1[a-z0-9]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/;

/**
 * Validate an address for a given chain. Returns the normalized address
 * (lowercased for EVM) or throws a ValidationError.
 */
export function validateAddress(chain: Chain, rawAddress: string): string {
  const address = rawAddress.trim();
  const meta = CHAINS[chain];

  if (meta.evm) {
    if (!EVM_ADDRESS.test(address)) {
      throw new ValidationError(`Invalid ${meta.name} address. Expected a 0x… EVM address.`);
    }
    return address.toLowerCase();
  }

  if (chain === Chain.SOLANA) {
    if (!SOLANA_ADDRESS.test(address)) {
      throw new ValidationError('Invalid Solana address.');
    }
    return address;
  }

  if (chain === Chain.BITCOIN) {
    if (!BTC_ADDRESS.test(address)) {
      throw new ValidationError('Invalid Bitcoin address.');
    }
    return address;
  }

  throw new ValidationError(`Unsupported chain: ${chain}`);
}

/** Strip characters that could break embeds or be used for injection. */
export function sanitizeLabel(input: string, maxLength = 40): string {
  const cleaned = input
    .replace(/[`@*_~|<>]/g, '') // discord markdown + mentions
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
  if (!cleaned) throw new ValidationError('Label cannot be empty after sanitization.');
  return cleaned;
}

/** Parse & validate a positive numeric threshold from user input. */
export const thresholdSchema = z.coerce
  .number({ invalid_type_error: 'Threshold must be a number.' })
  .positive('Threshold must be greater than zero.')
  .finite();

/** Validate a comparator token. */
export const comparatorSchema = z.enum(['>', '<', '%']);

/** Generic helper: run a Zod schema and rethrow as a ValidationError. */
export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ValidationError(result.error.issues.map((i) => i.message).join('; '));
  }
  return result.data;
}
