/**
 * Lightweight in-process metrics collector.
 *
 * Tracks command usage, latencies, errors and job runs so the /admin dashboard
 * and the /metrics API endpoint can report live health without a full
 * Prometheus stack (which can still scrape the exposed values if desired).
 */

interface CommandStat {
  count: number;
  totalMs: number;
  errors: number;
}

class MetricsService {
  private readonly startedAt = Date.now();
  private commandStats = new Map<string, CommandStat>();
  private totalCommands = 0;
  private totalErrors = 0;
  private jobRuns = 0;
  private jobFailures = 0;
  /** Rolling API latency samples (last N). */
  private apiLatencies: number[] = [];

  /** Record a successful command execution and its latency. */
  recordCommand(name: string, ms: number): void {
    this.totalCommands += 1;
    const stat = this.commandStats.get(name) ?? { count: 0, totalMs: 0, errors: 0 };
    stat.count += 1;
    stat.totalMs += ms;
    this.commandStats.set(name, stat);
  }

  /** Record an error (optionally attributed to a command). */
  recordError(name?: string): void {
    this.totalErrors += 1;
    if (name) {
      const stat = this.commandStats.get(name) ?? { count: 0, totalMs: 0, errors: 0 };
      stat.errors += 1;
      this.commandStats.set(name, stat);
    }
  }

  /** Record a background job outcome. */
  recordJob(success: boolean): void {
    this.jobRuns += 1;
    if (!success) this.jobFailures += 1;
  }

  /** Record an API request latency (bounded ring buffer). */
  recordApiLatency(ms: number): void {
    this.apiLatencies.push(ms);
    if (this.apiLatencies.length > 500) this.apiLatencies.shift();
  }

  private avgApiLatency(): number {
    if (!this.apiLatencies.length) return 0;
    return this.apiLatencies.reduce((a, b) => a + b, 0) / this.apiLatencies.length;
  }

  /** Snapshot for dashboards & the API. */
  snapshot() {
    const uptimeMs = Date.now() - this.startedAt;
    return {
      uptimeMs,
      totalCommands: this.totalCommands,
      totalErrors: this.totalErrors,
      jobRuns: this.jobRuns,
      jobFailures: this.jobFailures,
      avgApiLatencyMs: Math.round(this.avgApiLatency()),
      memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      commands: Object.fromEntries(
        [...this.commandStats.entries()].map(([name, s]) => [
          name,
          { count: s.count, avgMs: s.count ? Math.round(s.totalMs / s.count) : 0, errors: s.errors },
        ]),
      ),
    };
  }
}

/** Shared metrics singleton. */
export const metrics = new MetricsService();
