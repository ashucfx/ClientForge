// src/lib/idempotency.ts
import { Redis } from '@upstash/redis';

export const IDEMPOTENCY_LOCKS = new Map<string, number>();

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  try {
    return Redis.fromEnv();
  } catch {
    return null;
  }
}

/**
 * Acquires a lock for a given key. Returns true if acquired, false if already locked.
 * Automatically expires the lock after `ttlMs`.
 *
 * NOTE: this in-memory variant is PER-INSTANCE only. On serverless it does not
 * prevent duplicate work across instances — use `acquireLockDurable` for that.
 */
export function acquireLock(key: string, ttlMs: number = 10000): boolean {
  const now = Date.now();
  const existing = IDEMPOTENCY_LOCKS.get(key);
  if (existing && now < existing) {
    return false; // Locked
  }
  IDEMPOTENCY_LOCKS.set(key, now + ttlMs);
  return true;
}

/**
 * Releases a lock early if needed.
 */
export function releaseLock(key: string) {
  IDEMPOTENCY_LOCKS.delete(key);
}

/**
 * Durable lock across all serverless instances when Upstash Redis is configured
 * (uses SET NX PX). Falls back to the per-instance in-memory lock otherwise.
 * Use this for money-path deduplication (e.g. checkout draft creation) so a
 * double-submit routed to two instances cannot create two invoices/payment links.
 */
export async function acquireLockDurable(key: string, ttlMs: number = 10000): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    try {
      const res = await redis.set(`lock:${key}`, '1', { nx: true, px: ttlMs });
      return res === 'OK';
    } catch {
      // Redis unreachable — fall back to in-memory so we still catch same-instance dupes.
    }
  }
  return acquireLock(key, ttlMs);
}

/**
 * Releases a durable lock. Safe to call even if Redis is unavailable.
 */
export async function releaseLockDurable(key: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(`lock:${key}`);
      return;
    } catch {
      // fall through to in-memory release
    }
  }
  releaseLock(key);
}
