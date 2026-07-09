import { Alert, AlertStatus, AlertType } from '@prisma/client';
import { AlertService } from '../../src/services/alert.service';

/** Build a minimal Alert fixture for the pure evaluation tests. */
function makeAlert(type: AlertType, threshold: number): Alert {
  return {
    id: 'a1',
    userId: 'u1',
    type,
    status: AlertStatus.ACTIVE,
    asset: 'bitcoin',
    threshold: threshold as unknown as Alert['threshold'],
    comparator: null,
    meta: null,
    lastValue: null,
    triggeredAt: null,
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('AlertService.shouldTrigger', () => {
  const service = new AlertService();

  it('fires PRICE_ABOVE when value >= threshold', () => {
    const alert = makeAlert(AlertType.PRICE_ABOVE, 50_000);
    expect(service.shouldTrigger(alert, 50_001)).toBe(true);
    expect(service.shouldTrigger(alert, 49_999)).toBe(false);
  });

  it('fires PRICE_BELOW when value <= threshold', () => {
    const alert = makeAlert(AlertType.PRICE_BELOW, 30_000);
    expect(service.shouldTrigger(alert, 29_999)).toBe(true);
    expect(service.shouldTrigger(alert, 30_001)).toBe(false);
  });

  it('fires GAS_BELOW when value <= threshold', () => {
    const alert = makeAlert(AlertType.GAS_BELOW, 20);
    expect(service.shouldTrigger(alert, 18)).toBe(true);
    expect(service.shouldTrigger(alert, 25)).toBe(false);
  });

  it('fires PERCENT_MOVE on absolute movement', () => {
    const alert = makeAlert(AlertType.PERCENT_MOVE, 10);
    expect(service.shouldTrigger(alert, -12)).toBe(true);
    expect(service.shouldTrigger(alert, 5)).toBe(false);
  });
});
