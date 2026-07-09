/**
 * Crypto news service.
 *
 * Fetches recent articles from CryptoCompare's free news API, maps them into
 * our categories, optionally generates a concise AI summary, and persists them
 * for the news feed & /news command.
 */
import { NewsCategory } from '@prisma/client';
import { AxiosInstance } from 'axios';
import { createHttpClient } from '../utils/http';
import { cache } from './cache.service';
import { CACHE_TTL } from '../config/constants';
import { env } from '../config/env';
import { NewsItem } from '../types';
import { aiService } from './ai.service';
import { newsRepository } from '../database/repositories/misc.repository';
import { createLogger } from '../utils/logger';
import { truncate } from '../utils/format';

const log = createLogger('NewsService');

interface CryptoCompareArticle {
  id: string;
  title: string;
  url: string;
  body: string;
  source: string;
  categories: string;
  published_on: number;
}

/** Map free-text provider categories/keywords onto our enum. */
function classify(title: string, categories: string): NewsCategory {
  const text = `${title} ${categories}`.toLowerCase();
  if (/\b(hack|exploit|breach|scam|phish|security)\b/.test(text)) return NewsCategory.SECURITY;
  if (/\b(sec|regulat|lawsuit|ban|policy|court)\b/.test(text)) return NewsCategory.REGULATION;
  if (/\b(nft|opensea|collectible)\b/.test(text)) return NewsCategory.NFT;
  if (/\b(defi|lending|dex|yield|staking)\b/.test(text)) return NewsCategory.DEFI;
  if (/\b(bitcoin|btc)\b/.test(text)) return NewsCategory.BITCOIN;
  if (/\b(ethereum|eth|vitalik)\b/.test(text)) return NewsCategory.ETHEREUM;
  if (/\b(altcoin|solana|cardano|xrp|doge)\b/.test(text)) return NewsCategory.ALTCOINS;
  return NewsCategory.MARKET;
}

export class NewsService {
  private readonly http: AxiosInstance;

  constructor() {
    const headers: Record<string, string> = {};
    if (env.CRYPTO_NEWS_API_KEY) headers.authorization = `Apikey ${env.CRYPTO_NEWS_API_KEY}`;
    this.http = createHttpClient({
      baseURL: env.CRYPTO_NEWS_BASE_URL,
      provider: 'cryptocompare-news',
      headers,
      timeoutMs: 12_000,
    });
  }

  /** Fetch & normalize the latest news (cached). */
  async fetchLatest(limit = 20): Promise<NewsItem[]> {
    return cache.wrap(`news:latest:${limit}`, CACHE_TTL.news, async () => {
      const { data } = await this.http.get<{ Data: CryptoCompareArticle[] }>('/news/', {
        params: { lang: 'EN', sortOrder: 'latest' },
      });
      return (data.Data ?? []).slice(0, limit).map((a) => ({
        title: a.title,
        url: a.url,
        source: a.source,
        category: classify(a.title, a.categories),
        summary: truncate(a.body, 280),
        publishedAt: new Date(a.published_on * 1000),
      }));
    });
  }

  /** Latest news filtered to a single category. */
  async fetchByCategory(category: NewsCategory, limit = 10): Promise<NewsItem[]> {
    const all = await this.fetchLatest(50);
    return all.filter((n) => n.category === category).slice(0, limit);
  }

  /**
   * Ingest the latest news into the DB, generating AI summaries when enabled.
   * Called by the scheduled news job. Returns the number of new articles.
   */
  async ingest(): Promise<number> {
    const items = await this.fetchLatest(20);
    let stored = 0;
    for (const item of items) {
      let summary = item.summary;
      if (env.AI_SUMMARY_ENABLED) {
        try {
          summary = await aiService.summarize(item.title, item.summary ?? '');
        } catch (error) {
          log.debug('AI summary failed, using excerpt', { message: (error as Error).message });
        }
      }
      await newsRepository.upsertArticle({
        title: item.title,
        url: item.url,
        source: item.source,
        category: item.category as NewsCategory,
        summary,
        publishedAt: item.publishedAt,
      });
      stored += 1;
    }
    log.info('News ingested', { count: stored });
    return stored;
  }
}

export const newsService = new NewsService();
