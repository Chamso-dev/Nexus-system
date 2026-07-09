/**
 * Formatting helpers for numbers, currency, percentages, addresses and time.
 * These keep embed output consistent and readable across the whole bot.
 */
import { EMOJI } from '../config/constants';

/** Format a USD amount with adaptive precision. */
export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (abs >= 1) return `$${value.toFixed(2)}`;
  if (abs >= 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toPrecision(4)}`;
}

/** Format a large integer with thousands separators. */
export function formatNumber(value: number | null | undefined, maxFractionDigits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A';
  return value.toLocaleString('en-US', { maximumFractionDigits: maxFractionDigits });
}

/** Format a token amount, trimming trailing zeros. */
export function formatAmount(value: number | null | undefined, symbol?: string): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A';
  const formatted =
    value >= 1
      ? value.toLocaleString('en-US', { maximumFractionDigits: 4 })
      : value.toPrecision(4);
  return symbol ? `${formatted} ${symbol}` : formatted;
}

/** Format a percentage with a directional arrow and sign. */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A';
  const arrow = value > 0 ? EMOJI.up : value < 0 ? EMOJI.down : '➖';
  const sign = value > 0 ? '+' : '';
  return `${arrow} ${sign}${value.toFixed(2)}%`;
}

/** Shorten a blockchain address: 0x1234…abcd. */
export function shortenAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

/** Format a Discord relative timestamp (e.g. "3 minutes ago"). */
export function discordTimestamp(date: Date, style: 'R' | 'f' | 'F' | 't' | 'T' | 'd' | 'D' = 'R'): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
}

/** Truncate a string to a max length, adding an ellipsis. */
export function truncate(text: string, max = 100): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** Turn a duration in ms into a compact human string (1h 3m 4s). */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / 60_000) % 60;
  const hours = Math.floor(ms / 3_600_000) % 24;
  const days = Math.floor(ms / 86_400_000);
  return [days && `${days}d`, hours && `${hours}h`, minutes && `${minutes}m`, `${seconds}s`]
    .filter(Boolean)
    .join(' ');
}
