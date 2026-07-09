/**
 * Maintenance-mode flag.
 *
 * When enabled, the bot can reject non-admin commands and pause the scheduler.
 * Backed by Redis so the state is shared across shards/instances, with a memory
 * fallback for single-instance/dev use.
 */
import { cache } from './cache.service';

const KEY = 'system:maintenance';

class MaintenanceService {
  private local = false;

  async set(enabled: boolean): Promise<void> {
    this.local = enabled;
    await cache.setRaw(KEY, enabled ? '1' : '0', 86_400);
  }

  async isEnabled(): Promise<boolean> {
    const raw = await cache.getRaw(KEY);
    if (raw !== null) return raw === '1';
    return this.local;
  }
}

export const maintenance = new MaintenanceService();
