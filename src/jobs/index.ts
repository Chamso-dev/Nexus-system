/**
 * Job registry — the ordered set of jobs the scheduler runs each tick.
 * This is the "every minute: check prices, wallets, gas, news, whales, alerts"
 * pipeline from the spec.
 */
import { Job } from './job.interface';
import { priceCacheJob } from './priceCache.job';
import { walletWatchJob } from './walletWatch.job';
import { gasAlertsJob } from './gasAlerts.job';
import { newsJob } from './news.job';
import { priceAlertsJob } from './priceAlerts.job';

/** All jobs, in the order they should be evaluated. */
export const jobs: Job[] = [
  priceCacheJob, // 1. refresh prices/market first (others depend on fresh data)
  priceAlertsJob, // 2. price & movement alerts
  gasAlertsJob, // 3. gas alerts
  walletWatchJob, // 4. wallet activity + whale/large-transfer detection
  newsJob, // 5. news ingest
];
