/**
 * User repository — data-access layer for users & their settings.
 *
 * Repositories encapsulate all Prisma queries for an aggregate so the service
 * layer never touches the ORM directly. This keeps business logic testable
 * (mock the repo) and centralizes query concerns.
 */
import { PremiumTier, Prisma, User, UserSetting } from '@prisma/client';
import { prisma } from '../prisma';

export class UserRepository {
  /** Ensure a user row exists, returning it (creates settings too). */
  async ensure(id: string, username?: string): Promise<User> {
    return prisma.user.upsert({
      where: { id },
      create: {
        id,
        username,
        settings: { create: {} },
      },
      update: username ? { username } : {},
    });
  }

  findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  getSettings(userId: string): Promise<UserSetting | null> {
    return prisma.userSetting.findUnique({ where: { userId } });
  }

  updateSettings(
    userId: string,
    data: Prisma.UserSettingUncheckedUpdateInput,
  ): Promise<UserSetting> {
    const { userId: _ignored, ...rest } = data as Prisma.UserSettingUncheckedCreateInput;
    return prisma.userSetting.upsert({
      where: { userId },
      create: { userId, ...rest },
      update: data,
    });
  }

  update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return prisma.user.update({ where: { id }, data });
  }

  setPremium(id: string, tier: PremiumTier, until?: Date): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { premiumTier: tier, premiumUntil: until ?? null },
    });
  }

  count(): Promise<number> {
    return prisma.user.count();
  }
}

export const userRepository = new UserRepository();
