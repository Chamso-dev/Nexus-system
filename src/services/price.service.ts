/**
 * Price & market data service (CoinGecko).
 *
 * All price/market reads are cached (see CacheService) to respect CoinGecko's
 * rate limits and keep the bot responsive at scale. The provider is isolated
 * here so it can be swapped without touching commands.
 */
import { AxiosInstance } from 'axios';
import { createHttpClient } from '../utils/http';
import { cache } from './cache.service';
import { env } from '../config/env';
import { CACHE_TTL } from '../config/constants';
import { createLogger } from '../utils/logger';
import { FearGreed, MarketOverview, PriceQuote } from '../types';

const log = createLogger('PriceService');

interface CoinMarket {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number | null;
  price_change_percentage_7d_in_currency?: number | null;
  price_change_percentage_30d_in_currency?: number | null;
  market_cap: number | null;
  total_volume: number | null;
  last_updated: string;
}

export class PriceService {
  private readonly http: AxiosInstance;

  constructor() {
    const headers: Record<string, string> = {};
    if (env.COINGECKO_API_KEY) headers['x-cg-pro-api-key'] = env.COINGECKO_API_KEY;
    this.http = createHttpClient({
      baseURL: env.COINGECKO_BASE_URL,
      provider: 'coingecko',
      headers,
      timeoutMs: 12_000,
    });
  }

  /** Fetch quotes for a set of CoinGecko asset ids. */
  async getQuotes(ids: string[]): Promise<PriceQuote[]> {
    if (!ids.length) return [];
    const key = `price:quotes:${[...ids].sort().join(',')}`;
    return cache.wrap(key, CACHE_TTL.price, async () => {
      const { data } = await this.http.get<CoinMarket[]>('/coins/markets', {
        params: {
          vs_currency: 'usd',
          ids: ids.join(','),
          price_change_percentage: '24h,7d,30d',
          per_page: 250,
        },
      });
      return data.map(this.toQuote);
    });
  }

  /** Convenience: a single quote by id. */
  async getQuote(id: string): Promise<PriceQuote | null> {
    const [quote] = await this.getQuotes([id]);
    return quote ?? null;
  }

  /** Map CoinGecko market data into our normalized quote. */
  private toQuote(coin: CoinMarket): PriceQuote {
    return {
      assetId: coin.id,
      symbol: coin.symbol.toUpperCase(),
      usd: coin.current_price,
      change24h: coin.price_change_percentage_24h,
      change7d: coin.price_change_percentage_7d_in_currency ?? null,
      change30d: coin.price_change_percentage_30d_in_currency ?? null,
      marketCap: coin.market_cap,
      volume24h: coin.total_volume,
      lastUpdated: new Date(coin.last_updated),
    };
  }

  /** Search assets by free-text query (used by autocomplete). */
  async search(query: string): Promise<{ id: string; symbol: string; name: string }[]> {
    if (!query.trim()) return [];
    const key = `price:search:${query.toLowerCase()}`;
    return cache.wrap(key, 300, async () => {
      const { data } = await this.http.get<{
        coins: { id: string; symbol: string; name: string }[];
      }>('/search', { params: { query } });
      return data.coins.slice(0, 25).map((c) => ({ id: c.id, symbol: c.symbol, name: c.name }));
    });
  }

  /** Trending coins (CoinGecko /search/trending). */
  async getTrending(): Promise<{ id: string; symbol: string; name: string }[]> {
    return cache.wrap('price:trending', CACHE_TTL.market, async () => {
      const { data } = await this.http.get<{
        coins: { item: { id: string; symbol: string; name: string } }[];
      }>('/search/trending');
      return data.coins.map((c) => c.item);
    });
  }

  /** Global market stats (dominance, total cap, volume). */
  async getGlobal(): Promise<{
    totalMarketCap: number;
    totalVolume: number;
    btcDominance: number;
  } | null> {
    return cache.wrap('price:global', CACHE_TTL.market, async () => {
      const { data } = await this.http.get<{
        data: {
          total_market_cap: { usd: number };
          total_volume: { usd: number };
          market_cap_percentage: { btc: number };
        };
      }>('/global');
      return {
        totalMarketCap: data.data.total_market_cap.usd,
        totalVolume: data.data.total_volume.usd,
        btcDominance: data.data.market_cap_percentage.btc,
      };
    });
  }

  /** Fear & Greed index via alternative.me (separate provider, cached). */
  async getFearGreed(): Promise<FearGreed | null> {
    return cache.wrap('price:feargreed', CACHE_TTL.market, async () => {
      try {
        const client = createHttpClient({ provider: 'alternative.me', timeoutMs: 8_000 });
        const { data } = await client.get<{
          data: { value: string; value_classification: string; timestamp: string }[];
        }>('https://api.alternative.me/fng/');
        const item = data.data[0];
        return {
          value: Number(item.value),
          classification: item.value_classification,
          timestamp: new Date(Number(item.timestamp) * 1000),
        };
      } catch (error) {
        log.debug('Fear & Greed fetch failed', { message: (error as Error).message });
        return null;
      }
    });
  }

  /**
   * Build the full market overview for /market. Combines featured coins, the
   * top-100 for gainers/losers, trending, global stats and Fear & Greed.
   */
  async getMarketOverview(): Promise<MarketOverview> {
    return cache.wrap('price:overview', CACHE_TTL.market, async () => {
      const [top, trending, global, fearGreed] = await Promise.all([
        this.http
          .get<CoinMarket[]>('/coins/markets', {
            params: {
              vs_currency: 'usd',
              order: 'market_cap_desc',
              per_page: 100,
              page: 1,
              price_change_percentage: '24h',
            },
          })
          .then((r) => r.data.map(this.toQuote)),
        this.getTrending(),
        this.getGlobal(),
        this.getFearGreed(),
      ]);

      const featuredIds = ['bitcoin', 'ethereum', 'solana', 'binancecoin'];
      const featured = featuredIds
        .map((id) => top.find((q) => q.assetId === id))
        .filter((q): q is PriceQuote => Boolean(q));

      const byChange = [...top].filter((q) => q.change24h !== null);
      const topGainers = [...byChange].sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0)).slice(0, 5);
      const topLosers = [...byChange].sort((a, b) => (a.change24h ?? 0) - (b.change24h ?? 0)).slice(0, 5);

      return {
        featured,
        topGainers,
        topLosers,
        trending: trending.slice(0, 7),
        fearGreed: fearGreed
          ? { value: fearGreed.value, classification: fearGreed.classification }
          : null,
        btcDominance: global?.btcDominance ?? null,
        totalMarketCap: global?.totalMarketCap ?? null,
        totalVolume24h: global?.totalVolume ?? null,
      };
    });
  }
}

export const priceService = new PriceService();
