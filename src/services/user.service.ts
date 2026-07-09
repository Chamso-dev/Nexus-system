/**
 * User service — profile, settings, premium status and plan limits.
 *
 * Business rules about what a free vs. premium user may do live here, keeping
 * commands thin and consistent.
 */
import { PremiumTier } from '@prisma/client';
import { userRepository } from '../database/repositories/user.repository';
import { env } from '../config/env';

export interface PlanLimits {
  maxWallets: number;
  maxAlerts: number;
}

export class UserService {
  /** Ensure the user exists in the DB (call at the top of user-facing commands). */
  async ensure(id: string, username?: string) {
    return userRepository.ensure(id, username);
  }

  /** Whether the user currently has an active premium tier. */
  async isPremium(id: string): Promise<boolean> {
    const user = await userRepository.findById(id);
    if (!user || user.premiumTier === PremiumTier.FREE) return false;
    if (user.premiumUntil && user.premiumUntil.getTime() < Date.now()) return false;
    return true;
  }

  /** Resolve the plan limits that apply to a user. */
  async getLimits(id: string): Promise<PlanLimits> {
    const premium = await this.isPremium(id);
    return premium
      ? { maxWallets: env.PREMIUM_MAX_WALLETS, maxAlerts: env.PREMIUM_MAX_ALERTS }
      : { maxWallets: env.FREE_MAX_WALLETS, maxAlerts: env.FREE_MAX_ALERTS };
  }

  getSettings(userId: string) {
    return userRepository.getSettings(userId);
  }

  updateTimezone(userId: string, timezone: string) {
    return userRepository.update(userId, { timezone });
  }

  updateLocale(userId: string, locale: string) {
    return userRepository.update(userId, { locale });
  }
}

export const userService = new UserService();
