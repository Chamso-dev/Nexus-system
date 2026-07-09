/**
 * Background job contract.
 *
 * A Job is a named unit of work the scheduler runs on a cadence. The scheduler
 * wraps every run with timing, persistence (JobRun) and retry/backoff, so job
 * implementations only need to contain their business logic in `run()`.
 */
export interface Job {
  /** Unique job name (used in logs & the JobRun table). */
  name: string;
  /** Max retry attempts on failure (0 = no retry). */
  maxRetries?: number;
  /** Base backoff (ms) between retries; doubled each attempt. */
  backoffMs?: number;
  /** The work to perform. Return a short summary for logging (optional). */
  run(): Promise<void | string>;
}
