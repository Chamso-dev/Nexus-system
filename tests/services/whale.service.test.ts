import { Chain } from '@prisma/client';
import { WhaleService, DEFAULT_WHALE_THRESHOLDS_USD } from '../../src/services/whale.service';

describe('WhaleService', () => {
  const service = new WhaleService();

  describe('isWhale', () => {
    it('uses the per-asset default threshold', () => {
      expect(service.isWhale('BTC', DEFAULT_WHALE_THRESHOLDS_USD.BTC + 1)).toBe(true);
      expect(service.isWhale('BTC', DEFAULT_WHALE_THRESHOLDS_USD.BTC - 1)).toBe(false);
    });

    it('falls back to the DEFAULT threshold for unknown assets', () => {
      expect(service.isWhale('FOO', DEFAULT_WHALE_THRESHOLDS_USD.DEFAULT)).toBe(true);
    });

    it('honors an explicit override', () => {
      expect(service.isWhale('BTC', 100, 50)).toBe(true);
      expect(service.isWhale('BTC', 40, 50)).toBe(false);
    });
  });

  describe('buildTransfer', () => {
    it('attaches the correct explorer URL', () => {
      const transfer = service.buildTransfer({
        chain: Chain.ETHEREUM,
        hash: '0xdeadbeef',
        asset: 'ETH',
        amount: 1000,
        usdValue: 3_000_000,
        from: '0xaaa',
        to: '0xbbb',
        timestamp: new Date(),
      });
      expect(transfer.explorerUrl).toBe('https://etherscan.io/tx/0xdeadbeef');
    });
  });
});
