/**
 * Scheduler — runs registered jobs on a cron cadence with retry + exponential
 * backoff, persistence of every run (JobRun), metrics, and overlap protection.
 *
 * The "every minute" pipeline (prices, wallets, gas, news, whales, alerts) is
 * registered here. Each job is independently retried so one flaky provider
 * doesn't stall the others.
 */
import cron, { ScheduledTask } from 'node-cron';
import { JobStatus } from '@prisma/client';
import { Job } from './job.interface';
import { jobRepository } from '../database/repositories/misc.repository';
import { metrics } from '../services/metrics.service';
import { maintenance } from '../services/maintenance.service';
import { env } from '../config/env';
import { createLogger } from '../utils/logger';
import { toError } from '../utils/errors';

const log = createLogger('Scheduler');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class Scheduler {
  private readonly tasks: ScheduledTask[] = [];
  /** Guards against a slow job overlapping its next tick. */
  private readonly running = new Set<string>();

  /**
   * Execute a single job with retry/backoff and full bookkeeping.
   * Public so /admin and tests can trigger a job on demand.
   */
  async runJob(job: Job): Promise<void> {
    if (this.running.has(job.name)) {
      log.debug('Skipping overlapping job run', { job: job.name });
      return;
    }
    this.running.add(job.name);

    const record = await jobRepository.start(job.name).catch(() => null);
    const started = Date.now();
    const maxRetries = job.maxRetries ?? 2;
    const backoffMs = job.backoffMs ?? 1000;

    try {
      let attempt = 0;
      // Retry loop with exponential backoff.
      for (;;) {
        try {
          const summary = await job.run();
          const duration = Date.now() - started;
          if (record) await jobRepository.finish(record.id, JobStatus.SUCCESS, duration);
          metrics.recordJob(true);
          log.debug('Job succeeded', { job: job.name, ms: duration, summary });
          return;
        } catch (error) {
          attempt += 1;
          if (attempt > maxRetries) throw error;
          const delay = backoffMs * 2 ** (attempt - 1);
          if (record) await jobRepository.incrementAttempt(record.id).catch(() => undefined);
          log.warn('Job failed, retrying', {
            job: job.name,
            attempt,
            delayMs: delay,
            message: toError(error).message,
          });
          await sleep(delay);
        }
      }
    } catch (error) {
      const duration = Date.now() - started;
      const message = toError(error).message;
      if (record) await jobRepository.finish(record.id, JobStatus.FAILED, duration, message);
      metrics.recordJob(false);
      log.error('Job failed permanently', { job: job.name, message });
    } finally {
      this.running.delete(job.name);
    }
  }

  /**
   * Register the main pipeline on the configured cron. All jobs run in parallel
   * each tick; the scheduler skips the whole tick while maintenance mode is on.
   */
  start(jobs: Job[]): void {
    if (!env.SCHEDULER_ENABLED) {
      log.warn('Scheduler disabled via SCHEDULER_ENABLED=false');
      return;
    }
    if (!cron.validate(env.SCHEDULER_TICK_CRON)) {
      log.error('Invalid SCHEDULER_TICK_CRON — scheduler not started', {
        cron: env.SCHEDULER_TICK_CRON,
      });
      return;
    }

    const task = cron.schedule(env.SCHEDULER_TICK_CRON, async () => {
      if (await maintenance.isEnabled()) {
        log.debug('Maintenance mode — skipping tick');
        return;
      }
      await Promise.allSettled(jobs.map((job) => this.runJob(job)));
    });

    this.tasks.push(task);
    log.info('Scheduler started', { cron: env.SCHEDULER_TICK_CRON, jobs: jobs.map((j) => j.name) });
  }

  /** Stop all scheduled tasks (graceful shutdown). */
  stop(): void {
    for (const task of this.tasks) task.stop();
    this.tasks.length = 0;
    log.info('Scheduler stopped');
  }
}

export const scheduler = new Scheduler();
