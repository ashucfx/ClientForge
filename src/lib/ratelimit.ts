// src/lib/ratelimit.ts
// DB-backed rate limiter using CareerActivityLog.
// Works across all serverless instances — no Redis required.
// For high-traffic production, replace with Upstash Redis.

import { prisma as db } from '@/lib/db';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Check and record an attempt keyed by `key` (e.g. "pin:{email}" or "ml:{email}").
 * Stores attempts in CareerActivityLog with action = `ratelimit:{action}`.
 *
 * @param key      Unique key for this rate-limit bucket (e.g. "pin:user@email.com")
 * @param action   Short name used as the DB action tag (e.g. "pin_attempt")
 * @param limit    Max allowed attempts in the window
 * @param windowMs Window duration in milliseconds
 */
export async function rateLimit(
  key: string,
  action: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const cutoff = new Date(Date.now() - windowMs);
  const dbAction = `ratelimit:${action}`;

  // Count recent attempts within the window
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

  // Record this attempt (non-blocking — don't await to keep response fast)
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
