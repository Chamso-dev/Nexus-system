/**
 * Gas alert job — notifies users when a chain's gas drops to/below their target.
 */
import { AlertType } from '@prisma/client';
import { Job } from './job.interface';
import { alertService } from '../services/alert.service';
import { gasService } from '../services/gas.service';
import { notificationService } from '../services/notification.service';
import { userService } from '../services/user.service';
import { successEmbed } from '../utils/embeds';
import { CHAINS, COLORS, EMOJI } from '../config/constants';
import { Chain } from '@prisma/client';

export const gasAlertsJob: Job = {
  name: 'gas-alerts',
  maxRetries: 2,
  async run() {
    const alerts = await alertService.activeByTypes([AlertType.GAS_BELOW]);
    if (!alerts.length) return 'no gas alerts';

    // Fetch each referenced chain's gas once.
    const chains = [...new Set(alerts.map((a) => a.asset).filter((x): x is string => Boolean(x)))];
    const gasByChain = new Map<string, number>();
    for (const chain of chains) {
      const snapshot = await gasService.getGas(chain as Chain).catch(() => null);
      if (snapshot) gasByChain.set(chain, snapshot.average);
    }

    let fired = 0;
    for (const alert of alerts) {
      const gas = alert.asset ? gasByChain.get(alert.asset) : undefined;
      if (gas === undefined) continue;
      if (!alertService.shouldTrigger(alert, gas)) continue;

      const settings = await userService.getSettings(alert.userId);
      if (settings && !settings.gasAlerts) {
        await alertService.markTriggered(alert.id, gas);
        continue;
      }

      const chainName = CHAINS[alert.asset as Chain]?.name ?? alert.asset;
      const embed = successEmbed(`${EMOJI.gas} Gas Alert — ${chainName}`)
        .setColor(COLORS.success)
        .setDescription(`Gas is now **${gas} gwei** (≤ your ${Number(alert.threshold)} gwei target).`);

      await notificationService.dmUser(alert.userId, embed);
      await alertService.markTriggered(alert.id, gas);
      fired += 1;
    }

    return `evaluated ${alerts.length}, fired ${fired}`;
  },
};
