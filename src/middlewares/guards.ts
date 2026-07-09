/**
 * Command guards (middleware).
 *
 * Each guard inspects the interaction + command metadata and throws a typed
 * AppError when a precondition fails. The interaction router catches these and
 * renders a friendly ephemeral message. Guards run in a deliberate order:
 *   owner → guildOnly → permissions → premium → cooldown.
 */
import {
  ChatInputCommandInteraction,
  GuildMember,
  PermissionsBitField,
} from 'discord.js';
import { env } from '../config/env';
import { AppError, PremiumRequiredError, RateLimitError } from '../utils/errors';
import { checkCooldown } from '../utils/cooldown';
import { DEFAULT_COOLDOWN_SECONDS } from '../config/constants';
import type { Command } from '../types/discord';
import { userService } from '../services/user.service';

/** Owner-only gate based on DISCORD_OWNER_IDS. */
export function assertOwner(interaction: ChatInputCommandInteraction, command: Command): void {
  if (!command.ownerOnly) return;
  if (!env.DISCORD_OWNER_IDS.includes(interaction.user.id)) {
    throw new AppError('This command is restricted to bot administrators.', {
      code: 'OWNER_ONLY',
      statusCode: 403,
    });
  }
}

/** Guild-only gate. */
export function assertGuild(interaction: ChatInputCommandInteraction, command: Command): void {
  if (command.guildOnly && !interaction.inGuild()) {
    throw new AppError('This command can only be used inside a server.', {
      code: 'GUILD_ONLY',
      statusCode: 400,
    });
  }
}

/** Permission gate — verifies the member has every required permission. */
export function assertPermissions(
  interaction: ChatInputCommandInteraction,
  command: Command,
): void {
  if (!command.permissions?.length || !interaction.inGuild()) return;
  const member = interaction.member as GuildMember | null;
  const perms = member?.permissions as PermissionsBitField | undefined;
  if (!perms) return;
  const missing = command.permissions.filter((p) => !perms.has(p));
  if (missing.length) {
    throw new AppError('You do not have permission to use this command.', {
      code: 'MISSING_PERMISSIONS',
      statusCode: 403,
      meta: { missing: missing.map(String) },
    });
  }
}

/** Premium gate — checks the user's stored tier. */
export async function assertPremium(
  interaction: ChatInputCommandInteraction,
  command: Command,
): Promise<void> {
  if (!command.premium || !env.PREMIUM_ENABLED) return;
  const isPremium = await userService.isPremium(interaction.user.id);
  if (!isPremium) throw new PremiumRequiredError();
}

/** Cooldown gate — throws RateLimitError with the remaining seconds. */
export async function assertCooldown(
  interaction: ChatInputCommandInteraction,
  command: Command,
): Promise<void> {
  const seconds = command.cooldown ?? DEFAULT_COOLDOWN_SECONDS;
  const remaining = await checkCooldown(command.data.name, interaction.user.id, seconds);
  if (remaining > 0) {
    throw new RateLimitError(
      `Please wait **${remaining}s** before using \`/${command.data.name}\` again.`,
      remaining,
    );
  }
}

/** Run all guards in order. */
export async function runGuards(
  interaction: ChatInputCommandInteraction,
  command: Command,
): Promise<void> {
  assertOwner(interaction, command);
  assertGuild(interaction, command);
  assertPermissions(interaction, command);
  await assertPremium(interaction, command);
  await assertCooldown(interaction, command);
}
