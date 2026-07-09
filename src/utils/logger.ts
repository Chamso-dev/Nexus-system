/**
 * Centralized Winston logger.
 *
 * Provides:
 *  - console output (colorized in dev, JSON in prod)
 *  - daily-rotated file transports for `error` and combined logs
 *  - a `child(context)` helper so each module can tag its logs
 *  - convenience timers for measuring API / DB latency
 */
import path from 'node:path';
import winston from 'winston';
import 'winston-daily-rotate-file';
import { env, isProduction } from '../config/env';

const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');

/** Human-friendly console format used in development. */
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, context, stack, ...meta }) => {
    const ctx = context ? `\x1b[36m[${context}]\x1b[0m ` : '';
    const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level} ${ctx}${stack || message}${rest}`;
  }),
);

/** Structured JSON format used in production (machine-parseable). */
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: isProduction ? prodFormat : devFormat,
  }),
];

// File transports are only enabled outside of tests to keep CI output clean.
if (env.NODE_ENV !== 'test') {
  transports.push(
    new winston.transports.DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '14d',
      maxSize: '20m',
      format: prodFormat,
    }),
    new winston.transports.DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '7d',
      maxSize: '20m',
      format: prodFormat,
    }),
  );
}

/** The root logger instance. */
export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  levels: winston.config.npm.levels,
  transports,
  exitOnError: false,
});

/**
 * Create a namespaced child logger. Prefer this in modules:
 *   const log = createLogger('WhaleService');
 */
export function createLogger(context: string): winston.Logger {
  return logger.child({ context });
}

/**
 * Start a latency timer. Call the returned function to log the elapsed time.
 * Useful for the "API latency / DB latency" logging requirement.
 */
export function startTimer(context: string, label: string) {
  const start = process.hrtime.bigint();
  return (meta: Record<string, unknown> = {}): number => {
    const ms = Number(process.hrtime.bigint() - start) / 1_000_000;
    logger.debug(`${label} completed`, { context, durationMs: Math.round(ms), ...meta });
    return ms;
  };
}
