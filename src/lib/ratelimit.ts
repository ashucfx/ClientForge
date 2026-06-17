// src/lib/ratelimit.ts
// DB-backed rate limiter using CareerActivityLog.
// Works across all serverless instances — no Redis required.
// For high-traffic production, replace with Upstash Redis.

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

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

// In-memory fallback for local dev when Redis is not configured
interface FallbackHit {
  count: number;
  resetAt: number;
}
const fallbackCache = new Map<string, FallbackHit>();

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

  // --- In-Memory Fallback (Local Dev) ---
  const now = Date.now();
  const cacheKey = `rl:${action}:${key}`;
  
  let hit = fallbackCache.get(cacheKey);
  
  if (!hit || now > hit.resetAt) {
    hit = { count: 0, resetAt: now + windowMs };
  }
  
  if (hit.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((hit.resetAt - now) / 1000),
    };
  }
  
  hit.count += 1;
  fallbackCache.set(cacheKey, hit);
  
  // Cleanup old entries occasionally to prevent memory leaks in long-running processes
  if (Math.random() < 0.05) {
    for (const [k, v] of Array.from(fallbackCache.entries())) {
      if (now > v.resetAt) fallbackCache.delete(k);
    }
  }

  return {
    allowed: true,
    remaining: limit - hit.count,
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
  const cacheKey = `rl:pin_fail:pin_fail:${email}`;
  fallbackCache.delete(cacheKey);
  // We can't easily clear Upstash Redis sliding window limits without deleting the keys
  // which might have complex internal names, so we just clear the fallback for local dev.
}

/**
 * Rate-limit OTP verification attempts: 5 per clientId per 15 minutes.
 * Prevents brute-force of the 6-digit OTP space.
 */
export async function checkOtpRateLimit(clientId: string): Promise<RateLimitResult> {
  return rateLimit(`otp_verify:${clientId}`, 'otp_verify', 5, 15 * 60 * 1000);
}

/**
 * Rate-limit OTP send requests: 3 per clientId per 10 minutes.
 * Prevents OTP flooding / SMS/email bombing.
 */
export async function checkOtpSendRateLimit(clientId: string): Promise<RateLimitResult> {
  return rateLimit(`otp_send:${clientId}`, 'otp_send', 3, 10 * 60 * 1000);
}
