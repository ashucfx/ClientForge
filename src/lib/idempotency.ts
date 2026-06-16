// src/lib/idempotency.ts
export const IDEMPOTENCY_LOCKS = new Map<string, number>();

/**
 * Acquires a lock for a given key. Returns true if acquired, false if already locked.
 * Automatically expires the lock after `ttlMs`.
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
