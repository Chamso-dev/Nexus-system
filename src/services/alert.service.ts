/**
 * Alert service — create/list/delete price, gas and movement alerts, and the
 * evaluation logic the scheduler uses to decide when an alert fires.
 */
import { Alert, AlertStatus, AlertType, Prisma } from '@prisma/client';
import { alertRepository } from '../database/repositories/alert.repository';
import { userService } from './user.service';
import { LimitError, NotFoundError, ValidationError } from '../utils/errors';

export interface CreateAlertInput {
  userId: string;
  type: AlertType;
  asset?: string;
  threshold?: number;
  comparator?: string;
  meta?: Prisma.InputJsonValue;
}

export class AlertService {
  list(userId: string, status?: AlertStatus): Promise<Alert[]> {
    return alertRepository.listByUser(userId, status);
  }

  /** Create an alert after enforcing the user's plan limit. */
  async create(input: CreateAlertInput): Promise<Alert> {
    const [count, limits] = await Promise.all([
      alertRepository.countActiveByUser(input.userId),
      userService.getLimits(input.userId),
    ]);
    if (count >= limits.maxAlerts) {
      throw new LimitError(
        `You have reached your active alert limit (${limits.maxAlerts}). Upgrade for more.`,
      );
    }
    if (
      (input.type === AlertType.PRICE_ABOVE || input.type === AlertType.PRICE_BELOW) &&
      (input.threshold === undefined || input.threshold <= 0)
    ) {
      throw new ValidationError('A positive price threshold is required for price alerts.');
    }

    return alertRepository.create({
      user: { connect: { id: input.userId } },
      type: input.type,
      asset: input.asset,
      threshold: input.threshold,
      comparator: input.comparator,
      meta: input.meta,
    });
  }

  async delete(userId: string, alertId: string): Promise<Alert> {
    const alert = await alertRepository.findById(alertId);
    if (!alert || alert.userId !== userId) throw new NotFoundError('Alert not found.');
    return alertRepository.delete(alertId);
  }

  async pause(userId: string, alertId: string): Promise<Alert> {
    const alert = await alertRepository.findById(alertId);
    if (!alert || alert.userId !== userId) throw new NotFoundError('Alert not found.');
    return alertRepository.update(alertId, { status: AlertStatus.PAUSED });
  }

  async resume(userId: string, alertId: string): Promise<Alert> {
    const alert = await alertRepository.findById(alertId);
    if (!alert || alert.userId !== userId) throw new NotFoundError('Alert not found.');
    return alertRepository.update(alertId, { status: AlertStatus.ACTIVE, triggeredAt: null });
  }

  /**
   * Pure evaluation: given an alert and the current observed value, decide if it
   * should fire. Kept side-effect-free so it is trivially unit-testable.
   */
  shouldTrigger(alert: Alert, currentValue: number): boolean {
    const threshold = alert.threshold !== null ? Number(alert.threshold) : null;
    switch (alert.type) {
      case AlertType.PRICE_ABOVE:
      case AlertType.MARKET_CAP_CHANGE:
        return threshold !== null && currentValue >= threshold;
      case AlertType.PRICE_BELOW:
      case AlertType.GAS_BELOW:
        return threshold !== null && currentValue <= threshold;
      case AlertType.PERCENT_MOVE:
      case AlertType.VOLUME_SPIKE:
        return threshold !== null && Math.abs(currentValue) >= threshold;
      default:
        return false;
    }
  }

  markTriggered(id: string, value: number): Promise<Alert> {
    return alertRepository.markTriggered(id, value);
  }

  activeByTypes(types: AlertType[]): Promise<Alert[]> {
    return alertRepository.findActiveByTypes(types);
  }
}

export const alertService = new AlertService();
