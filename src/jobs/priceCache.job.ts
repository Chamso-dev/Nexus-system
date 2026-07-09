/**
 * Price/market warm-up job.
 *
 * Pre-warms the market overview cache each tick so /market and dashboards are
 * instant for users and we make one upstream request instead of one-per-user.
 * This is the "check prices" leg of the every-minute pipeline.
 */
import { Job } from './job.interface';
import { priceService } from '../services/price.service';

export const priceCacheJob: Job = {
  name: 'price-cache',
  maxRetries: 2,
  async run() {
    const overview = await priceService.getMarketOverview();
    return `warmed ${overview.featured.length} featured, ${overview.topGainers.length} gainers`;
  },
};
