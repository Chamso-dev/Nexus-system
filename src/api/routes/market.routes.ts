/**
 * Public market summary endpoint.
 *  GET /market/summary — cached market overview (rate limited).
 */
import { Router } from 'express';
import { priceService } from '../../services/price.service';
import { apiRateLimit } from '../../middlewares/api.middleware';

export const marketRouter = Router();

marketRouter.get('/summary', apiRateLimit(30, 60), async (_req, res, next) => {
  try {
    const overview = await priceService.getMarketOverview();
    res.json({
      featured: overview.featured.map((q) => ({
        symbol: q.symbol,
        usd: q.usd,
        change24h: q.change24h,
      })),
      btcDominance: overview.btcDominance,
      totalMarketCap: overview.totalMarketCap,
      totalVolume24h: overview.totalVolume24h,
      fearGreed: overview.fearGreed,
      trending: overview.trending,
    });
  } catch (error) {
    next(error);
  }
});
