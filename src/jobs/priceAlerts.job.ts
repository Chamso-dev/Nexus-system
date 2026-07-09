/**
 * Price & movement alert job.
 *
 * Loads all active price/percentage/market-cap alerts, fetches the relevant
 * quotes in one batch, evaluates each alert, and delivers a DM when triggered.
 * Triggered alerts are marked so they don't re-fire until re-armed.
 */
import { AlertType } from '@prisma/client';
import { Job } from './job.interface';
import { alertService } from '../services/alert.service';
import { priceService } from '../services/price.service';
import { notificationService } from '../services/notification.service';
import { userService } from '../services/user.service';
import { successEmbed } from '../utils/embeds';
import { formatUsd, formatPercent } from '../utils/format';
import { COLORS } from '../config/constants';

const PRICE_TYPES = [AlertType.PRICE_ABOVE, AlertType.PRICE_BELOW, AlertType.PERCENT_MOVE];

export const priceAlertsJob: Job = {
  name: 'price-alerts',
  maxRetries: 2,
  async run() {
    const alerts = await alertService.activeByTypes(PRICE_TYPES);
    if (!alerts.length) return 'no active alerts';

    // Batch-fetch every referenced asset once.
    const assetIds = [...new Set(alerts.map((a) => a.asset).filter((x): x is string => Boolean(x)))];
    const quotes = await priceService.getQuotes(assetIds);
    const byId = new Map(quotes.map((q) => [q.assetId, q]));

    let fired = 0;
    for (const alert of alerts) {
      const quote = alert.asset ? byId.get(alert.asset) : undefined;
      if (!quote) continue;

      const currentValue =
        alert.type === AlertType.PERCENT_MOVE ? (quote.change24h ?? 0) : quote.usd;
      if (!alertService.shouldTrigger(alert, currentValue)) continue;

      // Respect the user's price-alert preference.
      const settings = await userService.getSettings(alert.userId);
      if (settings && !settings.priceAlerts) {
        await alertService.markTriggered(alert.id, currentValue);
        continue;
      }

      const embed = successEmbed(`🔔 ${quote.symbol} Alert Triggered`)
        .setColor(COLORS.gold)
        .setDescription(
          alert.type === AlertType.PERCENT_MOVE
            ? `**${quote.symbol}** moved ${formatPercent(quote.change24h)} in 24H (threshold ±${Number(alert.threshold)}%).`
            : `**${quote.symbol}** is now ${formatUsd(quote.usd)} ` +
              `(${alert.type === AlertType.PRICE_ABOVE ? 'above' : 'below'} your ${formatUsd(Number(alert.threshold))} target).`,
        );

      await notificationService.dmUser(alert.userId, embed);
      await alertService.markTriggered(alert.id, currentValue);
      fired += 1;
    }

    return `evaluated ${alerts.length}, fired ${fired}`;
  },
};
