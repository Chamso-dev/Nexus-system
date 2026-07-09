/**
 * Application-wide constants: branding, colors, chain metadata, limits.
 * Centralizing these keeps embeds consistent and makes adding chains trivial.
 */
import { Chain } from '@prisma/client';

/** Brand identity used across embeds. */
export const BRAND = {
  name: 'Nexus',
  tagline: 'Your all-in-one crypto companion',
  footer: 'Nexus • Not financial advice',
  website: 'https://github.com/Chamso-dev/Nexus-system',
} as const;

/** Embed color palette (decimal ints for discord.js). */
export const COLORS = {
  primary: 0x5865f2,
  success: 0x57f287,
  warning: 0xfee75c,
  danger: 0xed4245,
  info: 0x3498db,
  neutral: 0x2b2d31,
  gold: 0xf1c40f,
} as const;

/** Common emoji used in embeds. */
export const EMOJI = {
  up: '📈',
  down: '📉',
  wallet: '👛',
  whale: '🐋',
  gas: '⛽',
  news: '📰',
  bell: '🔔',
  chart: '📊',
  fire: '🔥',
  warning: '⚠️',
  check: '✅',
  cross: '❌',
  gem: '💎',
  rocket: '🚀',
} as const;

/** Static metadata describing each supported chain. */
export interface ChainMeta {
  chain: Chain;
  name: string;
  symbol: string;
  /** Native asset id on the price provider (CoinGecko). */
  coingeckoId: string;
  /** Number of decimals for the native asset. */
  decimals: number;
  /** Block explorer base URL (transaction path appended). */
  explorerTxUrl: string;
  /** Block explorer base URL for addresses. */
  explorerAddressUrl: string;
  /** Whether the chain is EVM-compatible (shared adapter logic). */
  evm: boolean;
}

/**
 * The single source of truth for chain metadata. To support a new chain:
 *   1. Add it to the `Chain` enum in prisma/schema.prisma.
 *   2. Add an entry here.
 *   3. Register an adapter in services/chains.
 */
export const CHAINS: Record<Chain, ChainMeta> = {
  BITCOIN: {
    chain: Chain.BITCOIN,
    name: 'Bitcoin',
    symbol: 'BTC',
    coingeckoId: 'bitcoin',
    decimals: 8,
    explorerTxUrl: 'https://mempool.space/tx/',
    explorerAddressUrl: 'https://mempool.space/address/',
    evm: false,
  },
  ETHEREUM: {
    chain: Chain.ETHEREUM,
    name: 'Ethereum',
    symbol: 'ETH',
    coingeckoId: 'ethereum',
    decimals: 18,
    explorerTxUrl: 'https://etherscan.io/tx/',
    explorerAddressUrl: 'https://etherscan.io/address/',
    evm: true,
  },
  BNB: {
    chain: Chain.BNB,
    name: 'BNB Chain',
    symbol: 'BNB',
    coingeckoId: 'binancecoin',
    decimals: 18,
    explorerTxUrl: 'https://bscscan.com/tx/',
    explorerAddressUrl: 'https://bscscan.com/address/',
    evm: true,
  },
  POLYGON: {
    chain: Chain.POLYGON,
    name: 'Polygon',
    symbol: 'MATIC',
    coingeckoId: 'matic-network',
    decimals: 18,
    explorerTxUrl: 'https://polygonscan.com/tx/',
    explorerAddressUrl: 'https://polygonscan.com/address/',
    evm: true,
  },
  SOLANA: {
    chain: Chain.SOLANA,
    name: 'Solana',
    symbol: 'SOL',
    coingeckoId: 'solana',
    decimals: 9,
    explorerTxUrl: 'https://solscan.io/tx/',
    explorerAddressUrl: 'https://solscan.io/account/',
    evm: false,
  },
  ARBITRUM: {
    chain: Chain.ARBITRUM,
    name: 'Arbitrum',
    symbol: 'ETH',
    coingeckoId: 'ethereum',
    decimals: 18,
    explorerTxUrl: 'https://arbiscan.io/tx/',
    explorerAddressUrl: 'https://arbiscan.io/address/',
    evm: true,
  },
  OPTIMISM: {
    chain: Chain.OPTIMISM,
    name: 'Optimism',
    symbol: 'ETH',
    coingeckoId: 'ethereum',
    decimals: 18,
    explorerTxUrl: 'https://optimistic.etherscan.io/tx/',
    explorerAddressUrl: 'https://optimistic.etherscan.io/address/',
    evm: true,
  },
  BASE: {
    chain: Chain.BASE,
    name: 'Base',
    symbol: 'ETH',
    coingeckoId: 'ethereum',
    decimals: 18,
    explorerTxUrl: 'https://basescan.org/tx/',
    explorerAddressUrl: 'https://basescan.org/address/',
    evm: true,
  },
  AVALANCHE: {
    chain: Chain.AVALANCHE,
    name: 'Avalanche',
    symbol: 'AVAX',
    coingeckoId: 'avalanche-2',
    decimals: 18,
    explorerTxUrl: 'https://snowtrace.io/tx/',
    explorerAddressUrl: 'https://snowtrace.io/address/',
    evm: true,
  },
};

/** Default cooldown (seconds) applied to commands that don't specify one. */
export const DEFAULT_COOLDOWN_SECONDS = 3;

/** Cache TTLs (seconds) for various data domains. */
export const CACHE_TTL = {
  price: 30,
  market: 60,
  gas: 20,
  news: 300,
  contract: 900,
} as const;

/** Standard disclaimer appended to risk-scanner output. */
export const RISK_DISCLAIMER =
  'This is automated, informational analysis only — **not** financial advice or a ' +
  'guarantee of safety. Always do your own research.';
