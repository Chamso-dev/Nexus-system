/**
 * Domain-specific embed builders.
 *
 * These turn service view-models (price quotes, gas snapshots, whale transfers,
 * portfolios, risk reports, market overview) into polished, consistent embeds.
 * Commands stay thin by delegating all presentation here.
 */
import { EmbedBuilder } from 'discord.js';
import { Chain } from '@prisma/client';
import { baseEmbed } from './embeds';
import { COLORS, EMOJI, CHAINS, RISK_DISCLAIMER } from '../config/constants';
import {
  formatUsd,
  formatPercent,
  formatNumber,
  formatAmount,
  shortenAddress,
  discordTimestamp,
} from './format';
import {
  ContractRiskReport,
  GasSnapshot,
  MarketOverview,
  PriceQuote,
  WhaleTransfer,
} from '../types';
import type { PortfolioValuation } from '../services/portfolio.service';

/** Pick a color based on a directional value. */
function changeColor(change: number | null | undefined): number {
  if (change === null || change === undefined) return COLORS.neutral;
  return change >= 0 ? COLORS.success : COLORS.danger;
}

/** Single-asset price embed. */
export function priceEmbed(quote: PriceQuote): EmbedBuilder {
  return baseEmbed()
    .setColor(changeColor(quote.change24h))
    .setTitle(`${quote.symbol} — ${formatUsd(quote.usd)}`)
    .addFields(
      { name: '24H', value: formatPercent(quote.change24h), inline: true },
      { name: '7D', value: formatPercent(quote.change7d ?? null), inline: true },
      { name: '30D', value: formatPercent(quote.change30d ?? null), inline: true },
      { name: 'Market Cap', value: formatUsd(quote.marketCap ?? null), inline: true },
      { name: '24H Volume', value: formatUsd(quote.volume24h ?? null), inline: true },
      { name: '​', value: '​', inline: true },
    );
}

/** Full market dashboard embed for /market. */
export function marketEmbed(overview: MarketOverview): EmbedBuilder {
  const featuredLines = overview.featured
    .map((q) => `**${q.symbol}** ${formatUsd(q.usd)}  ${formatPercent(q.change24h)}`)
    .join('\n');

  const gainers = overview.topGainers
    .map((q) => `${EMOJI.up} **${q.symbol}** ${formatPercent(q.change24h)}`)
    .join('\n');
  const losers = overview.topLosers
    .map((q) => `${EMOJI.down} **${q.symbol}** ${formatPercent(q.change24h)}`)
    .join('\n');
  const trending = overview.trending.map((t) => `\`${t.symbol.toUpperCase()}\``).join(' ');

  const embed = baseEmbed()
    .setColor(COLORS.gold)
    .setTitle(`${EMOJI.chart} Market Dashboard`)
    .addFields(
      { name: 'Featured', value: featuredLines || 'N/A', inline: false },
      { name: 'Top Gainers (24H)', value: gainers || 'N/A', inline: true },
      { name: 'Top Losers (24H)', value: losers || 'N/A', inline: true },
    );

  if (trending) embed.addFields({ name: `${EMOJI.fire} Trending`, value: trending, inline: false });

  const globalLines: string[] = [];
  if (overview.totalMarketCap) globalLines.push(`Global Cap: **${formatUsd(overview.totalMarketCap)}**`);
  if (overview.totalVolume24h) globalLines.push(`24H Volume: **${formatUsd(overview.totalVolume24h)}**`);
  if (overview.btcDominance) globalLines.push(`BTC Dominance: **${overview.btcDominance.toFixed(1)}%**`);
  if (overview.fearGreed)
    globalLines.push(
      `Fear & Greed: **${overview.fearGreed.value}** (${overview.fearGreed.classification})`,
    );
  if (globalLines.length) embed.addFields({ name: 'Global', value: globalLines.join('\n') });

  return embed;
}

/** Combined gas embed across chains. */
export function gasEmbed(snapshots: GasSnapshot[]): EmbedBuilder {
  const embed = baseEmbed().setColor(COLORS.info).setTitle(`${EMOJI.gas} Gas Tracker (gwei)`);
  if (!snapshots.length) {
    return embed.setDescription('Gas data is currently unavailable.');
  }
  for (const gas of snapshots) {
    embed.addFields({
      name: CHAINS[gas.chain].name,
      value: `🟢 ${gas.low}  🟡 ${gas.average}  🔴 ${gas.high}`,
      inline: true,
    });
  }
  return embed;
}

/** Whale transfer embed with every required field. */
export function whaleEmbed(transfer: WhaleTransfer): EmbedBuilder {
  return baseEmbed()
    .setColor(COLORS.primary)
    .setTitle(`${EMOJI.whale} Whale Transfer — ${formatAmount(transfer.amount, transfer.asset)}`)
    .addFields(
      { name: 'USD Value', value: formatUsd(transfer.usdValue), inline: true },
      { name: 'Chain', value: CHAINS[transfer.chain].name, inline: true },
      { name: 'Block', value: transfer.blockNumber ? String(transfer.blockNumber) : 'N/A', inline: true },
      { name: 'From', value: `\`${shortenAddress(transfer.from)}\``, inline: true },
      { name: 'To', value: `\`${shortenAddress(transfer.to)}\``, inline: true },
      { name: 'Time', value: discordTimestamp(transfer.timestamp), inline: true },
      { name: 'Transaction', value: `[View on explorer](${transfer.explorerUrl})`, inline: false },
    );
}

/** Portfolio valuation embed with allocation & P/L. */
export function portfolioEmbed(valuation: PortfolioValuation): EmbedBuilder {
  const embed = baseEmbed()
    .setColor(changeColor(valuation.change24hPct))
    .setTitle(`${EMOJI.chart} Portfolio — ${valuation.name}`)
    .setDescription(
      `**Total Value:** ${formatUsd(valuation.totalUsd)}\n` +
        `**24H Change:** ${formatUsd(valuation.change24hUsd)} (${formatPercent(valuation.change24hPct)})` +
        (valuation.totalPnlUsd !== null
          ? `\n**Total P/L:** ${formatUsd(valuation.totalPnlUsd)}`
          : ''),
    );

  const top = valuation.holdings.slice(0, 10);
  if (top.length) {
    const lines = top
      .map(
        (h) =>
          `**${h.holding.symbol}** — ${formatUsd(h.valueUsd)} ` +
          `(${h.allocationPct.toFixed(1)}%) ${formatPercent(h.change24h)}`,
      )
      .join('\n');
    embed.addFields({ name: 'Top Holdings', value: lines });

    // Simple text allocation bar for the largest positions.
    const bar = top
      .slice(0, 5)
      .map((h) => {
        const blocks = Math.max(1, Math.round(h.allocationPct / 10));
        return `${h.holding.symbol.padEnd(6)} ${'█'.repeat(blocks)} ${h.allocationPct.toFixed(0)}%`;
      })
      .join('\n');
    embed.addFields({ name: 'Allocation', value: `\`\`\`\n${bar}\n\`\`\`` });
  } else {
    embed.addFields({ name: 'Holdings', value: 'No holdings yet. Use `/portfolio add`.' });
  }

  return embed;
}

/** Contract risk report embed with mandatory disclaimer. */
export function contractEmbed(report: ContractRiskReport): EmbedBuilder {
  const color =
    report.riskLabel === 'HIGH'
      ? COLORS.danger
      : report.riskLabel === 'MEDIUM'
        ? COLORS.warning
        : report.riskLabel === 'LOW'
          ? COLORS.success
          : COLORS.neutral;

  const flag = (value: boolean | null): string =>
    value === null ? '❔ Unknown' : value ? `${EMOJI.check} Yes` : `${EMOJI.cross} No`;

  return baseEmbed()
    .setColor(color)
    .setTitle(`🛡️ Contract Risk — ${report.riskLabel} (${report.riskScore}/100)`)
    .setDescription(`\`${report.address}\` on **${CHAINS[report.chain].name}**`)
    .addFields(
      { name: 'Verified Source', value: flag(report.verified), inline: true },
      { name: 'Upgradeable Proxy', value: flag(report.isProxy), inline: true },
      { name: 'Ownership Renounced', value: flag(report.ownerRenounced), inline: true },
      { name: 'Mint Function', value: flag(report.hasMint), inline: true },
      { name: 'Pause Function', value: flag(report.hasPause), inline: true },
      { name: 'Blacklist Capability', value: flag(report.hasBlacklist), inline: true },
    )
    .addFields({
      name: 'Notes',
      value: report.notes.filter((n) => n !== RISK_DISCLAIMER).map((n) => `• ${n}`).join('\n') || '—',
    })
    .addFields({ name: '⚠️ Disclaimer', value: RISK_DISCLAIMER });
}

/** Helper used by wallet listings. */
export function walletLine(chain: Chain, address: string, label?: string | null): string {
  const name = label ? `**${label}**` : `\`${shortenAddress(address)}\``;
  return `${CHAINS[chain].symbol} ${name} — [explorer](${CHAINS[chain].explorerAddressUrl}${address})`;
}

/** Format a large USD number for whale thresholds, etc. */
export function bigUsd(value: number): string {
  return formatNumber(value, 0);
}
