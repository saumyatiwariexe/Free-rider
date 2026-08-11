import { Redis } from '@upstash/redis';

/** Default cache TTL: 5 minutes */
export const DEFAULT_TTL_SECONDS = 300;

/**
 * Lazily create the Redis client on first use.
 * Returns null when the env vars are missing (build-time, CI, or unconfigured deploys)
 * so that the rest of the app can degrade gracefully instead of crashing.
 */
function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    // Only warn at runtime, not repeatedly — build-time evaluation is silent.
    if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
      console.warn(
        '[Redis] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set — caching disabled.'
      );
    }
    return null;
  }

  return new Redis({ url, token });
}

/**
 * Get a cached value by key. Returns null on miss or when Redis is unconfigured.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedis();
  if (!client) return null;
  try {
    const value = await client.get<T>(key);
    return value ?? null;
  } catch (err) {
    console.error(`[Redis] GET error for key "${key}":`, err);
    return null;
  }
}

/**
 * Set a value in cache with an optional TTL (defaults to 5 min).
 * No-ops silently when Redis is unconfigured.
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    await client.set(key, value, { ex: ttlSeconds });
  } catch (err) {
    console.error(`[Redis] SET error for key "${key}":`, err);
  }
}

/**
 * Delete a cached key (e.g., on token revocation).
 * No-ops silently when Redis is unconfigured.
 */
export async function cacheDel(key: string): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    await client.del(key);
  } catch (err) {
    console.error(`[Redis] DEL error for key "${key}":`, err);
  }
}
