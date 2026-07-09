/**
 * AI summarization service (optional).
 *
 * Generates concise news summaries via an Anthropic-compatible Messages API.
 * Fully optional and disabled by default (AI_SUMMARY_ENABLED). When disabled or
 * misconfigured, callers fall back to a plain excerpt — the bot never blocks on
 * AI availability.
 */
import { AxiosInstance } from 'axios';
import { createHttpClient } from '../utils/http';
import { env } from '../config/env';
import { truncate } from '../utils/format';
import { createLogger } from '../utils/logger';

const log = createLogger('AiService');

export class AiService {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = createHttpClient({
      baseURL: env.AI_BASE_URL,
      provider: 'ai-summary',
      timeoutMs: 20_000,
      headers: {
        'x-api-key': env.AI_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
    });
  }

  get enabled(): boolean {
    return env.AI_SUMMARY_ENABLED && Boolean(env.AI_API_KEY);
  }

  /**
   * Produce a 1–2 sentence summary of an article. On any failure we degrade to
   * a truncated excerpt so the news pipeline never breaks.
   */
  async summarize(title: string, body: string): Promise<string> {
    const fallback = truncate(body || title, 240);
    if (!this.enabled) return fallback;

    try {
      const { data } = await this.http.post<{ content: { text: string }[] }>('/v1/messages', {
        model: env.AI_MODEL,
        max_tokens: 160,
        messages: [
          {
            role: 'user',
            content:
              `Summarize this crypto news in 1-2 neutral sentences (no hype, no advice):\n\n` +
              `Title: ${title}\n\n${truncate(body, 1500)}`,
          },
        ],
      });
      return data.content?.[0]?.text?.trim() || fallback;
    } catch (error) {
      log.debug('summarize failed', { message: (error as Error).message });
      return fallback;
    }
  }
}

export const aiService = new AiService();
