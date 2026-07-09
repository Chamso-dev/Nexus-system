/**
 * Shared domain types used across services, commands and the API.
 * Keeping these framework-agnostic lets the service layer stay decoupled
 * from discord.js and Express.
 */
import { Chain, TransactionDirection, TransactionKind } from '@prisma/client';

/** A normalized on-chain transaction returned by any chain adapter. */
export interface NormalizedTransaction {
  chain: Chain;
  hash: string;
  blockNumber?: bigint;
  direction: TransactionDirection;
  kind: TransactionKind;
  from?: string;
  to?: string;
  assetSymbol?: string;
  /** Human-readable amount (already divided by decimals). */
  amount?: number;
  usdValue?: number;
  confirmed: boolean;
  timestamp: Date;
}

/** A price quote for a single asset. */
export interface PriceQuote {
  assetId: string;
  symbol: string;
  usd: number;
  change24h: number | null;
  change7d?: number | null;
  change30d?: number | null;
  marketCap?: number | null;
  volume24h?: number | null;
  lastUpdated: Date;
}

/** Gas price snapshot for an EVM chain (values in gwei). */
export interface GasSnapshot {
  chain: Chain;
  low: number;
  average: number;
  high: number;
  baseFee?: number | null;
  updatedAt: Date;
}

/** A large ("whale") transfer surfaced by the whale monitor. */
export interface WhaleTransfer {
  chain: Chain;
  hash: string;
  asset: string;
  amount: number;
  usdValue: number;
  from: string;
  to: string;
  blockNumber?: bigint;
  timestamp: Date;
  explorerUrl: string;
}

/** Aggregate market overview for the /market dashboard. */
export interface MarketOverview {
  featured: PriceQuote[];
  topGainers: PriceQuote[];
  topLosers: PriceQuote[];
  trending: { id: string; symbol: string; name: string }[];
  fearGreed?: { value: number; classification: string } | null;
  btcDominance?: number | null;
  totalMarketCap?: number | null;
  totalVolume24h?: number | null;
}

/** A single news item after normalization + optional AI summary. */
export interface NewsItem {
  title: string;
  url: string;
  source?: string;
  category: string;
  summary?: string;
  publishedAt: Date;
}

/** Result of a smart-contract risk scan. */
export interface ContractRiskReport {
  chain: Chain;
  address: string;
  verified: boolean | null;
  ownerRenounced: boolean | null;
  isProxy: boolean | null;
  hasMint: boolean | null;
  hasPause: boolean | null;
  hasBlacklist: boolean | null;
  auditLinks: string[];
  liquidityUsd: number | null;
  /** 0 (low) – 100 (high) computed risk score. */
  riskScore: number;
  riskLabel: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  notes: string[];
}

/** Fear & Greed index reading. */
export interface FearGreed {
  value: number;
  classification: string;
  timestamp: Date;
}

/** Generic paginated result wrapper. */
export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
