// src/lib/ratelimit.ts
// DB-backed rate limiter using CareerActivityLog.
// Works across all serverless instances — no Redis required.
// For high-traffic production, replace with Upstash Redis.

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { prisma as db } from '@/lib/db';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

// Lazy-initialize Redis only if environment variables exist
const getRedisLimiter = (limit: number, windowMs: number) => {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  return new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
    analytics: false,
  });
};

/**
 * Check and record an attempt keyed by `key`.
 * Uses Upstash Redis if configured, otherwise falls back to DB-backed CareerActivityLog.
 */
export async function rateLimit(
  key: string,
  action: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const redisLimiter = getRedisLimiter(limit, windowMs);
  
  if (redisLimiter) {
    try {
      const { success, remaining, reset } = await redisLimiter.limit(`rl:${action}:${key}`);
      return {
        allowed: success,
        remaining,
        retryAfterSeconds: Math.ceil((reset - Date.now()) / 1000),
      };
    } catch (err) {
      console.warn('Redis rate limit failed, falling back to DB:', err);
      // Fall through to DB fallback
    }
  }

  // --- DB Fallback ---
  const cutoff = new Date(Date.now() - windowMs);
  const dbAction = `ratelimit:${action}`;

  const count = await db.careerActivityLog.count({
    where: {
      action:      dbAction,
      performedBy: key,
      createdAt:   { gte: cutoff },
    },
  });

  if (count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  db.careerActivityLog.create({
    data: { clientId: 'SYSTEM', action: dbAction, performedBy: key },
  }).catch(() => null);

  return {
    allowed: true,
    remaining: limit - count - 1,
    retryAfterSeconds: 0,
  };
}

/**
 * Record a failed PIN login attempt and check if the account is locked.
 * Uses "pin_fail:{email}" as the key, 5 attempts per 15 min.
 */
export async function checkPinRateLimit(email: string): Promise<RateLimitResult> {
  return rateLimit(`pin_fail:${email}`, 'pin_fail', 5, 15 * 60 * 1000);
}

/**
 * Rate-limit magic link requests: 3 per email per hour.
 * Uses silent success for enumeration safety — caller decides whether to reveal limit.
 */
export async function checkMagicLinkRateLimit(email: string): Promise<RateLimitResult> {
  return rateLimit(`magic_link:${email}`, 'magic_link', 3, 60 * 60 * 1000);
}

/** Clear pin fail attempts after a successful login (optional — reduces lockout after password reset). */
export async function clearPinFailures(email: string): Promise<void> {
  await db.careerActivityLog.deleteMany({
    where: { action: 'ratelimit:pin_fail', performedBy: `pin_fail:${email}` },
  }).catch(() => null);
}
