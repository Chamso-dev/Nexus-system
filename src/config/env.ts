/**
 * Environment loading & validation.
 *
 * All process configuration flows through here. We parse `process.env` once,
 * validate it with Zod, and export a strongly-typed, frozen `env` object.
 * The rest of the codebase must never read `process.env` directly — this keeps
 * configuration auditable and prevents scattered, unvalidated access.
 */
import 'dotenv/config';
import { z } from 'zod';

/** Coerce common truthy/falsey string representations into a boolean. */
const booleanFromString = (defaultValue: boolean) =>
  z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined || value === '') return defaultValue;
      return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
    });

/** Parse a comma-separated list into a trimmed string array. */
const csv = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );

const envSchema = z.object({
  // Core
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),

  // Discord
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required'),
  DISCORD_DEV_GUILD_ID: z.string().optional().default(''),
  DISCORD_OWNER_IDS: csv,

  // Database / cache
  DATABASE_URL: z.string().url().or(z.string().startsWith('postgres')),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // API
  API_PORT: z.coerce.number().int().positive().default(3000),
  API_HOST: z.string().default('0.0.0.0'),
  API_AUTH_TOKEN: z.string().default('change-me'),
  WEBHOOK_SECRET: z.string().default('change-me-webhook-secret'),

  // Market data
  COINGECKO_API_KEY: z.string().optional().default(''),
  COINGECKO_BASE_URL: z.string().url().default('https://api.coingecko.com/api/v3'),

  // On-chain providers
  ETHERSCAN_API_KEY: z.string().optional().default(''),
  BSCSCAN_API_KEY: z.string().optional().default(''),
  POLYGONSCAN_API_KEY: z.string().optional().default(''),
  ARBISCAN_API_KEY: z.string().optional().default(''),
  OPTIMISM_ETHERSCAN_API_KEY: z.string().optional().default(''),
  BASESCAN_API_KEY: z.string().optional().default(''),
  SNOWTRACE_API_KEY: z.string().optional().default(''),
  BITCOIN_API_BASE_URL: z.string().url().default('https://blockstream.info/api'),
  SOLANA_RPC_URL: z.string().url().default('https://api.mainnet-beta.solana.com'),

  // News
  CRYPTO_NEWS_API_KEY: z.string().optional().default(''),
  CRYPTO_NEWS_BASE_URL: z.string().url().default('https://min-api.cryptocompare.com/data/v2'),

  // AI summary
  AI_SUMMARY_ENABLED: booleanFromString(false),
  AI_API_KEY: z.string().optional().default(''),
  AI_BASE_URL: z.string().url().default('https://api.anthropic.com'),
  AI_MODEL: z.string().default('claude-haiku-4-5-20251001'),

  // Scheduler
  SCHEDULER_ENABLED: booleanFromString(true),
  SCHEDULER_TICK_CRON: z.string().default('* * * * *'),

  // Feature flags / limits
  PREMIUM_ENABLED: booleanFromString(true),
  FREE_MAX_WALLETS: z.coerce.number().int().nonnegative().default(3),
  FREE_MAX_ALERTS: z.coerce.number().int().nonnegative().default(5),
  PREMIUM_MAX_WALLETS: z.coerce.number().int().nonnegative().default(50),
  PREMIUM_MAX_ALERTS: z.coerce.number().int().nonnegative().default(100),
  DEFAULT_LOCALE: z.string().default('en'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse & validate the environment. On failure we print a readable report and
 * exit — a misconfigured bot must fail fast rather than start half-broken.
 */
function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    // eslint-disable-next-line no-console
    console.error(`\n❌ Invalid environment configuration:\n${issues}\n`);
    process.exit(1);
  }
  return Object.freeze(parsed.data);
}

export const env = loadEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export const isDevelopment = env.NODE_ENV === 'development';
