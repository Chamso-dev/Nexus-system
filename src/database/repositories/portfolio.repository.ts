/**
 * Portfolio repository — portfolios, holdings and valuation snapshots.
 */
import { Holding, Portfolio, PortfolioSnapshot, Prisma } from '@prisma/client';
import { prisma } from '../prisma';

export class PortfolioRepository {
  listByUser(userId: string): Promise<Portfolio[]> {
    return prisma.portfolio.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  }

  countByUser(userId: string): Promise<number> {
    return prisma.portfolio.count({ where: { userId } });
  }

  async ensureDefault(userId: string, name = 'Main'): Promise<Portfolio> {
    return prisma.portfolio.upsert({
      where: { userId_name: { userId, name } },
      create: { userId, name },
      update: {},
    });
  }

  withHoldings(id: string): Promise<(Portfolio & { holdings: Holding[] }) | null> {
    return prisma.portfolio.findUnique({ where: { id }, include: { holdings: true } });
  }

  upsertHolding(
    portfolioId: string,
    data: Omit<Prisma.HoldingCreateManyInput, 'portfolioId'>,
  ): Promise<Holding> {
    return prisma.holding.upsert({
      where: { portfolioId_assetId: { portfolioId, assetId: data.assetId } },
      create: { portfolioId, ...data },
      update: { amount: data.amount, symbol: data.symbol, costBasisUsd: data.costBasisUsd },
    });
  }

  removeHolding(portfolioId: string, assetId: string): Promise<Prisma.BatchPayload> {
    return prisma.holding.deleteMany({ where: { portfolioId, assetId } });
  }

  addSnapshot(portfolioId: string, totalUsd: number): Promise<PortfolioSnapshot> {
    return prisma.portfolioSnapshot.create({ data: { portfolioId, totalUsd } });
  }

  recentSnapshots(portfolioId: string, take = 30): Promise<PortfolioSnapshot[]> {
    return prisma.portfolioSnapshot.findMany({
      where: { portfolioId },
      orderBy: { takenAt: 'desc' },
      take,
    });
  }
}

export const portfolioRepository = new PortfolioRepository();
