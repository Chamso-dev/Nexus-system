/**
 * News ingest job — pulls the latest articles, generates AI summaries (if
 * enabled), and stores them. Delivery of per-category digests to subscribers
 * is throttled: this job ingests every tick but only the freshest items persist
 * (deduped by URL), keeping DB writes cheap.
 */
import { Job } from './job.interface';
import { newsService } from '../services/news.service';

export const newsJob: Job = {
  name: 'news-ingest',
  maxRetries: 1,
  backoffMs: 3000,
  async run() {
    const count = await newsService.ingest();
    return `ingested ${count} articles`;
  },
};
