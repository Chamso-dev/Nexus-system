/**
 * Cache service — a thin abstraction over Redis with an in-memory fallback.
 *
 * Every read-through helper (`wrap`) transparently caches provider responses so
 * we respect upstream rate limits (CoinGecko, explorers, ...) and keep the
 * "thousands of servers" goal achievable. If Redis is down we degrade to an
 * in-process LRU-ish map so the bot keeps working.
 */
import { redis, isRedisReady } from '../database/redis';
import { createLogger } from '../utils/logger';

const log = createLogger('Cache');

interface MemoryEntry {
  value: string;
  expiresAt: number;
}

/** Bounded in-memory fallback store (evicts oldest when over capacity). */
class MemoryStore {
  private readonly store = new Map<string, MemoryEntry>();
  private readonly maxEntries = 5_000;

  get(key: string): string | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: string, ttlSeconds: number): void {
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  del(key: string): void {
    this.store.delete(key);
  }
}

const memory = new MemoryStore();

export class CacheService {
  /** Namespace prefix keeps bot keys separated from anything else in Redis. */
  private readonly prefix = 'nexus:';

  private k(key: string): string {
    return `${this.prefix}${key}`;
  }

  /** Get a raw string value from cache (Redis, falling back to memory). */
  async getRaw(key: string): Promise<string | null> {
    const full = this.k(key);
    if (isRedisReady()) {
      try {
        return await redis.get(full);
      } catch (error) {
        log.debug('Redis get failed, using memory', { message: (error as Error).message });
      }
    }
    return memory.get(full);
  }

  /** Set a raw string value with a TTL (seconds). */
  async setRaw(key: string, value: string, ttlSeconds: number): Promise<void> {
    const full = this.k(key);
    memory.set(full, value, ttlSeconds);
    if (isRedisReady()) {
      try {
        await redis.set(full, value, 'EX', ttlSeconds);
      } catch (error) {
        log.debug('Redis set failed, memory-only', { message: (error as Error).message });
      }
    }
  }

  /** Get and JSON-parse a cached value. */
  async get<T>(key: string): Promise<T | null> {
    const raw = await this.getRaw(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  /** JSON-stringify and cache a value. */
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.setRaw(key, JSON.stringify(value), ttlSeconds);
  }

  /** Delete a cached key. */
  async del(key: string): Promise<void> {
    const full = this.k(key);
    memory.del(full);
    if (isRedisReady()) {
      try {
        await redis.del(full);
      } catch {
        /* ignore */
      }
    }
  }

  /**
   * Read-through cache helper. Returns the cached value if present; otherwise
   * runs `producer`, caches the result and returns it.
   */
  async wrap<T>(key: string, ttlSeconds: number, producer: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await producer();
    // Never cache null/undefined — treat as a miss next time.
    if (value !== null && value !== undefined) {
      await this.set(key, value, ttlSeconds);
    }
    return value;
  }
}

/** Shared cache instance. */
export const cache = new CacheService();
