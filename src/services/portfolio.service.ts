/**
 * Portfolio service — valuation, P/L, allocation and historical performance.
 *
 * Holdings are priced live via the PriceService; a snapshot is taken on each
 * valuation so /portfolio can show 24H/7D/30D change and a performance history.
 */
import { Holding } from '@prisma/client';
import { portfolioRepository } from '../database/repositories/portfolio.repository';
import { priceService } from './price.service';
import { NotFoundError } from '../utils/errors';

export interface HoldingValuation {
  holding: Holding;
  price: number;
  valueUsd: number;
  allocationPct: number;
  change24h: number | null;
  pnlUsd: number | null;
  pnlPct: number | null;
}

export interface PortfolioValuation {
  portfolioId: string;
  name: string;
  totalUsd: number;
  change24hUsd: number;
  change24hPct: number | null;
  holdings: HoldingValuation[];
  totalPnlUsd: number | null;
}

export class PortfolioService {
  list(userId: string) {
    return portfolioRepository.listByUser(userId);
  }

  ensureDefault(userId: string) {
    return portfolioRepository.ensureDefault(userId);
  }

  /** Add or update a holding, then re-value. */
  async setHolding(
    portfolioId: string,
    assetId: string,
    symbol: string,
    amount: number,
    costBasisUsd?: number,
  ) {
    return portfolioRepository.upsertHolding(portfolioId, {
      assetId,
      symbol: symbol.toUpperCase(),
      amount,
      costBasisUsd: costBasisUsd ?? null,
    });
  }

  removeHolding(portfolioId: string, assetId: string) {
    return portfolioRepository.removeHolding(portfolioId, assetId);
  }

  /**
   * Compute a full valuation of a portfolio: total value, per-asset allocation,
   * 24H change and profit/loss vs. cost basis. Also records a snapshot.
   */
  async value(portfolioId: string, recordSnapshot = false): Promise<PortfolioValuation> {
    const portfolio = await portfolioRepository.withHoldings(portfolioId);
    if (!portfolio) throw new NotFoundError('Portfolio not found.');

    const ids = portfolio.holdings.map((h) => h.assetId);
    const quotes = await priceService.getQuotes(ids);
    const quoteById = new Map(quotes.map((q) => [q.assetId, q]));

    // First pass: value each holding.
    const valued = portfolio.holdings.map((holding) => {
      const quote = quoteById.get(holding.assetId);
      const price = quote?.usd ?? 0;
      const amount = Number(holding.amount);
      const valueUsd = price * amount;
      const change24h = quote?.change24h ?? null;
      const costBasis = holding.costBasisUsd !== null ? Number(holding.costBasisUsd) : null;
      const pnlUsd = costBasis !== null ? valueUsd - costBasis : null;
      const pnlPct = costBasis && costBasis > 0 ? ((valueUsd - costBasis) / costBasis) * 100 : null;
      return { holding, price, valueUsd, change24h, pnlUsd, pnlPct };
    });

    const totalUsd = valued.reduce((sum, v) => sum + v.valueUsd, 0);

    // Second pass: allocation % and aggregate 24H delta.
    const holdings: HoldingValuation[] = valued.map((v) => ({
      ...v,
      allocationPct: totalUsd > 0 ? (v.valueUsd / totalUsd) * 100 : 0,
    }));

    // 24H change: reconstruct yesterday's value from each asset's % change.
    const prevTotal = valued.reduce((sum, v) => {
      if (v.change24h === null) return sum + v.valueUsd;
      return sum + v.valueUsd / (1 + v.change24h / 100);
    }, 0);
    const change24hUsd = totalUsd - prevTotal;
    const change24hPct = prevTotal > 0 ? (change24hUsd / prevTotal) * 100 : null;

    const totalPnl = holdings.reduce<number | null>((sum, h) => {
      if (h.pnlUsd === null) return sum;
      return (sum ?? 0) + h.pnlUsd;
    }, null);

    if (recordSnapshot) {
      await portfolioRepository.addSnapshot(portfolioId, totalUsd);
    }

    return {
      portfolioId,
      name: portfolio.name,
      totalUsd,
      change24hUsd,
      change24hPct,
      holdings: holdings.sort((a, b) => b.valueUsd - a.valueUsd),
      totalPnlUsd: totalPnl,
    };
  }

  /** Recent valuation snapshots for a performance sparkline. */
  history(portfolioId: string) {
    return portfolioRepository.recentSnapshots(portfolioId);
  }
}

export const portfolioService = new PortfolioService();
