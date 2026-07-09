/**
 * Reusable embed builders.
 *
 * Every user-facing response should go through one of these so branding,
 * colors and the "not financial advice" footer stay consistent.
 */
import { EmbedBuilder } from 'discord.js';
import { BRAND, COLORS } from '../config/constants';

/** Base embed pre-filled with brand footer and timestamp. */
export function baseEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.primary)
    .setFooter({ text: BRAND.footer })
    .setTimestamp(new Date());
}

export function successEmbed(title: string, description?: string): EmbedBuilder {
  const embed = baseEmbed().setColor(COLORS.success).setTitle(`✅ ${title}`);
  if (description) embed.setDescription(description);
  return embed;
}

export function errorEmbed(title: string, description?: string): EmbedBuilder {
  const embed = baseEmbed().setColor(COLORS.danger).setTitle(`❌ ${title}`);
  if (description) embed.setDescription(description);
  return embed;
}

export function warningEmbed(title: string, description?: string): EmbedBuilder {
  const embed = baseEmbed().setColor(COLORS.warning).setTitle(`⚠️ ${title}`);
  if (description) embed.setDescription(description);
  return embed;
}

export function infoEmbed(title: string, description?: string): EmbedBuilder {
  const embed = baseEmbed().setColor(COLORS.info).setTitle(title);
  if (description) embed.setDescription(description);
  return embed;
}
