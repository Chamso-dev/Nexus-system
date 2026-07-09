import {
  formatUsd,
  formatPercent,
  shortenAddress,
  truncate,
  formatDuration,
} from '../../src/utils/format';

describe('format utils', () => {
  describe('formatUsd', () => {
    it('abbreviates large numbers', () => {
      expect(formatUsd(2_500_000_000)).toBe('$2.50B');
      expect(formatUsd(3_400_000)).toBe('$3.40M');
    });
    it('handles small and null values', () => {
      expect(formatUsd(0.00001234)).toContain('$');
      expect(formatUsd(null)).toBe('N/A');
      expect(formatUsd(undefined)).toBe('N/A');
    });
  });

  describe('formatPercent', () => {
    it('adds a sign and arrow', () => {
      expect(formatPercent(5.2)).toContain('+5.20%');
      expect(formatPercent(-3.1)).toContain('-3.10%');
      expect(formatPercent(null)).toBe('N/A');
    });
  });

  describe('shortenAddress', () => {
    it('shortens long addresses', () => {
      const addr = '0x1234567890abcdef1234567890abcdef12345678';
      expect(shortenAddress(addr)).toBe('0x1234…5678');
    });
    it('leaves short strings intact', () => {
      expect(shortenAddress('0x12')).toBe('0x12');
    });
  });

  describe('truncate', () => {
    it('truncates and appends an ellipsis', () => {
      expect(truncate('hello world', 5)).toBe('hell…');
      expect(truncate('short', 20)).toBe('short');
    });
  });

  describe('formatDuration', () => {
    it('formats compound durations', () => {
      expect(formatDuration(3_661_000)).toBe('1h 1m 1s');
      expect(formatDuration(5_000)).toBe('5s');
    });
  });
});
