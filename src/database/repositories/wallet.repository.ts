/**
 * Wallet repository — CRUD for watched wallets and their observed transactions.
 */
import { Chain, Prisma, Transaction, Wallet } from '@prisma/client';
import { prisma } from '../prisma';

export class WalletRepository {
  listByUser(userId: string): Promise<Wallet[]> {
    return prisma.wallet.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  }

  countByUser(userId: string): Promise<number> {
    return prisma.wallet.count({ where: { userId } });
  }

  findById(id: string): Promise<Wallet | null> {
    return prisma.wallet.findUnique({ where: { id } });
  }

  findByAddress(userId: string, chain: Chain, address: string): Promise<Wallet | null> {
    return prisma.wallet.findUnique({
      where: { userId_chain_address: { userId, chain, address } },
    });
  }

  create(data: Prisma.WalletCreateInput): Promise<Wallet> {
    return prisma.wallet.create({ data });
  }

  update(id: string, data: Prisma.WalletUpdateInput): Promise<Wallet> {
    return prisma.wallet.update({ where: { id }, data });
  }

  delete(id: string): Promise<Wallet> {
    return prisma.wallet.delete({ where: { id } });
  }

  /** Wallets due for a balance/activity check (used by the scheduler). */
  findActiveForScan(limit = 200): Promise<Wallet[]> {
    return prisma.wallet.findMany({
      where: { active: true },
      orderBy: { lastCheckedAt: { sort: 'asc', nulls: 'first' } },
      take: limit,
    });
  }

  /** Persist a batch of newly observed transactions, ignoring duplicates. */
  async recordTransactions(
    walletId: string,
    txs: Prisma.TransactionCreateManyInput[],
  ): Promise<number> {
    if (!txs.length) return 0;
    const result = await prisma.transaction.createMany({
      data: txs.map((t) => ({ ...t, walletId })),
      skipDuplicates: true,
    });
    return result.count;
  }

  recentTransactions(walletId: string, take = 10): Promise<Transaction[]> {
    return prisma.transaction.findMany({
      where: { walletId },
      orderBy: { timestamp: 'desc' },
      take,
    });
  }
}

export const walletRepository = new WalletRepository();
