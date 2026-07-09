/**
 * Jest global setup — runs before any test module is imported.
 *
 * Provides the minimum environment the config loader requires so importing
 * application modules (which validate env at import time) doesn't exit the
 * process. Values are dummies; tests never touch real services/network.
 */
process.env.NODE_ENV = 'test';
process.env.DISCORD_TOKEN = 'test-token';
process.env.DISCORD_CLIENT_ID = '123456789012345678';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test?schema=public';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.LOG_LEVEL = 'error';
process.env.SCHEDULER_ENABLED = 'false';
