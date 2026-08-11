import { Redis } from '@upstash/redis';

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error(
    'Missing Upstash Redis env vars: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required.'
  );
}

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

/** Default cache TTL: 5 minutes */
export const DEFAULT_TTL_SECONDS = 300;

/**
 * Get a cached value by key. Returns null on miss.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const value = await redis.get<T>(key);
    return value ?? null;
  } catch (err) {
    console.error(`[Redis] GET error for key "${key}":`, err);
    return null;
  }
}

/**
 * Set a value in cache with an optional TTL (defaults to 5 min).
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<void> {
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch (err) {
    console.error(`[Redis] SET error for key "${key}":`, err);
  }
}

/**
 * Delete a cached key (e.g., on token revocation).
 */
export async function cacheDel(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (err) {
    console.error(`[Redis] DEL error for key "${key}":`, err);
  }
}
