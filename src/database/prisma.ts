/**
 * Prisma client singleton with query-latency logging and graceful lifecycle.
 *
 * We expose a single shared `prisma` instance to avoid exhausting the DB
 * connection pool (a new client per import would open new pools). In
 * development we guard against hot-reload duplicates via `globalThis`.
 */
import { PrismaClient } from '@prisma/client';
import { createLogger } from '../utils/logger';
import { isProduction } from '../config/env';

const log = createLogger('Prisma');

/** Build a client with event-based logging wired to Winston. */
function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'warn', emit: 'event' },
      { level: 'error', emit: 'event' },
    ],
  });

  // Log slow queries so we can satisfy the "database latency" requirement.
  // Casts are required because Prisma's event typings depend on the log config.
  (client.$on as (event: string, callback: (e: { duration: number; query: string }) => void) => void)(
    'query',
    (event) => {
      if (event.duration > 200) {
        log.warn('Slow query', { durationMs: event.duration, query: event.query });
      }
    },
  );
  (client.$on as (event: string, callback: (e: { message: string }) => void) => void)('warn', (event) => {
    log.warn(event.message);
  });
  (client.$on as (event: string, callback: (e: { message: string }) => void) => void)('error', (event) => {
    log.error(event.message);
  });

  return client;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (!isProduction) globalForPrisma.prisma = prisma;

/** Verify DB connectivity — used by health checks and startup. */
export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  log.info('Database connection established');
}

/** Close the pool during graceful shutdown. */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  log.info('Database connection closed');
}

/** Lightweight health probe returning latency in ms, or throwing on failure. */
export async function databaseHealth(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  return { ok: true, latencyMs: Date.now() - start };
}
