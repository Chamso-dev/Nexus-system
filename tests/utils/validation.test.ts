import { Chain } from '@prisma/client';
import { validateAddress, sanitizeLabel } from '../../src/utils/validation';
import { ValidationError } from '../../src/utils/errors';

describe('validateAddress', () => {
  it('accepts and lowercases a valid EVM address', () => {
    const addr = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
    expect(validateAddress(Chain.ETHEREUM, addr)).toBe(addr.toLowerCase());
  });

  it('rejects an invalid EVM address', () => {
    expect(() => validateAddress(Chain.ETHEREUM, '0x123')).toThrow(ValidationError);
  });

  it('accepts a bech32 Bitcoin address', () => {
    const addr = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
    expect(validateAddress(Chain.BITCOIN, addr)).toBe(addr);
  });

  it('accepts a base58 Solana address', () => {
    const addr = '4Nd1mYc1a2b3c4d5e6f7g8h9J1K2L3M4N5P6Q7R8S9T';
    expect(validateAddress(Chain.SOLANA, addr)).toBe(addr);
  });
});

describe('sanitizeLabel', () => {
  it('strips markdown and mentions', () => {
    expect(sanitizeLabel('my `wallet` @everyone')).toBe('my wallet everyone');
  });

  it('throws when nothing remains', () => {
    expect(() => sanitizeLabel('```')).toThrow(ValidationError);
  });

  it('truncates to the max length', () => {
    expect(sanitizeLabel('a'.repeat(100), 10)).toHaveLength(10);
  });
});
