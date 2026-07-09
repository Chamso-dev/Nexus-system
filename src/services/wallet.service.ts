/**
 * Wallet service — add/remove/rename/list watched wallets and enforce plan
 * limits. Address validation & normalization is delegated to the chain adapter
 * so every chain's rules live in exactly one place.
 */
import { Chain, Wallet } from '@prisma/client';
import { walletRepository } from '../database/repositories/wallet.repository';
import { userService } from './user.service';
import { getChainAdapter } from './chains/registry';
import { sanitizeLabel } from '../utils/validation';
import { LimitError, NotFoundError, ValidationError } from '../utils/errors';

export class WalletService {
  list(userId: string): Promise<Wallet[]> {
    return walletRepository.listByUser(userId);
  }

  /** Add a wallet, enforcing the user's plan limit and de-duplicating. */
  async add(
    userId: string,
    chain: Chain,
    rawAddress: string,
    label?: string,
    thresholdUsd?: number,
  ): Promise<Wallet> {
    const address = getChainAdapter(chain).normalizeAddress(rawAddress);

    const [count, limits, existing] = await Promise.all([
      walletRepository.countByUser(userId),
      userService.getLimits(userId),
      walletRepository.findByAddress(userId, chain, address),
    ]);

    if (existing) throw new ValidationError('You are already watching this wallet.');
    if (count >= limits.maxWallets) {
      throw new LimitError(
        `You have reached your wallet limit (${limits.maxWallets}). Upgrade to premium for more.`,
      );
    }

    return walletRepository.create({
      user: { connect: { id: userId } },
      chain,
      address,
      label: label ? sanitizeLabel(label) : null,
      alertThreshold: thresholdUsd ?? 0,
    });
  }

  /** Remove a wallet the user owns. */
  async remove(userId: string, walletId: string): Promise<Wallet> {
    const wallet = await walletRepository.findById(walletId);
    if (!wallet || wallet.userId !== userId) throw new NotFoundError('Wallet not found.');
    return walletRepository.delete(walletId);
  }

  /** Rename a wallet the user owns. */
  async rename(userId: string, walletId: string, label: string): Promise<Wallet> {
    const wallet = await walletRepository.findById(walletId);
    if (!wallet || wallet.userId !== userId) throw new NotFoundError('Wallet not found.');
    return walletRepository.update(walletId, { label: sanitizeLabel(label) });
  }

  /** Update the "large transfer" USD threshold for a wallet. */
  async setThreshold(userId: string, walletId: string, thresholdUsd: number): Promise<Wallet> {
    const wallet = await walletRepository.findById(walletId);
    if (!wallet || wallet.userId !== userId) throw new NotFoundError('Wallet not found.');
    return walletRepository.update(walletId, { alertThreshold: thresholdUsd });
  }

  /** Live native balance for a wallet via its chain adapter. */
  async getBalance(chain: Chain, address: string): Promise<number | null> {
    return getChainAdapter(chain).getNativeBalance(address);
  }
}

export const walletService = new WalletService();
