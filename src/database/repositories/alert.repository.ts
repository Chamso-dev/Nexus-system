/**
 * Alert repository — CRUD & scheduler queries for user alerts.
 */
import { Alert, AlertStatus, AlertType, Prisma } from '@prisma/client';
import { prisma } from '../prisma';

export class AlertRepository {
  listByUser(userId: string, status?: AlertStatus): Promise<Alert[]> {
    return prisma.alert.findMany({
      where: { userId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  countActiveByUser(userId: string): Promise<number> {
    return prisma.alert.count({ where: { userId, status: AlertStatus.ACTIVE } });
  }

  findById(id: string): Promise<Alert | null> {
    return prisma.alert.findUnique({ where: { id } });
  }

  create(data: Prisma.AlertCreateInput): Promise<Alert> {
    return prisma.alert.create({ data });
  }

  update(id: string, data: Prisma.AlertUpdateInput): Promise<Alert> {
    return prisma.alert.update({ where: { id }, data });
  }

  delete(id: string): Promise<Alert> {
    return prisma.alert.delete({ where: { id } });
  }

  /** All active alerts of the given types — consumed by the alert job. */
  findActiveByTypes(types: AlertType[]): Promise<Alert[]> {
    return prisma.alert.findMany({
      where: { status: AlertStatus.ACTIVE, type: { in: types } },
    });
  }

  markTriggered(id: string, value: number): Promise<Alert> {
    return prisma.alert.update({
      where: { id },
      data: { status: AlertStatus.TRIGGERED, triggeredAt: new Date(), lastValue: value },
    });
  }
}

export const alertRepository = new AlertRepository();
