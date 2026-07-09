/**
 * Typed application error hierarchy.
 *
 * A single base class (`AppError`) carries an HTTP-ish status code, a machine
 * code, an "operational" flag (expected vs. programmer error) and optional
 * user-facing detail. The centralized handlers use these to decide how to
 * respond to the user and whether to page/alert.
 */

export interface AppErrorOptions {
  /** Machine-readable code, e.g. "WALLET_LIMIT_REACHED". */
  code?: string;
  /** HTTP status for the API layer. */
  statusCode?: number;
  /** True for expected errors we can safely show the user. */
  isOperational?: boolean;
  /** Original error for chaining/logging. */
  cause?: unknown;
  /** Extra structured context. */
  meta?: Record<string, unknown>;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly meta?: Record<string, unknown>;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code ?? 'APP_ERROR';
    this.statusCode = options.statusCode ?? 500;
    this.isOperational = options.isOperational ?? true;
    this.meta = options.meta;
    if (options.cause) (this as { cause?: unknown }).cause = options.cause;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/** Input failed validation (Zod, address format, etc.). */
export class ValidationError extends AppError {
  constructor(message: string, meta?: Record<string, unknown>) {
    super(message, { code: 'VALIDATION_ERROR', statusCode: 400, meta });
  }
}

/** A requested entity was not found. */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', meta?: Record<string, unknown>) {
    super(message, { code: 'NOT_FOUND', statusCode: 404, meta });
  }
}

/** The user tried to exceed a plan limit (wallets, alerts, ...). */
export class LimitError extends AppError {
  constructor(message: string, meta?: Record<string, unknown>) {
    super(message, { code: 'LIMIT_REACHED', statusCode: 403, meta });
  }
}

/** A required feature is gated behind premium. */
export class PremiumRequiredError extends AppError {
  constructor(message = 'This feature requires a premium subscription.') {
    super(message, { code: 'PREMIUM_REQUIRED', statusCode: 402 });
  }
}

/** An upstream provider (price/chain/news API) failed. */
export class ProviderError extends AppError {
  constructor(message: string, cause?: unknown, meta?: Record<string, unknown>) {
    super(message, { code: 'PROVIDER_ERROR', statusCode: 502, cause, meta });
  }
}

/** The user hit a rate limit / cooldown. */
export class RateLimitError extends AppError {
  constructor(message = 'You are doing that too fast. Please slow down.', retryAfter?: number) {
    super(message, { code: 'RATE_LIMITED', statusCode: 429, meta: { retryAfter } });
  }
}

/** Type guard for AppError. */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Normalize any thrown value into an Error instance. */
export function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  return new Error(typeof value === 'string' ? value : JSON.stringify(value));
}
