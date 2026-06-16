import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';

interface LimitConfig {
  limit: number;
  windowMs: number;
}

interface PublicRateLimitOptions {
  action: string;
  email?: string | null;
  ipLimit?: LimitConfig;
  emailLimit?: LimitConfig;
}

function clientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

function rateLimitResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: { 'Retry-After': String(Math.max(1, retryAfterSeconds)) },
    }
  );
}

export async function enforcePublicRateLimit(
  req: NextRequest,
  opts: PublicRateLimitOptions
): Promise<NextResponse | null> {
  const hasRedis = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );

  if (process.env.NODE_ENV === 'production' && !hasRedis) {
    console.error(`[rate-limit] Upstash Redis is required for public action ${opts.action}`);
    return NextResponse.json(
      { error: 'Service temporarily unavailable. Please try again later.' },
      { status: 503 }
    );
  }

  const ipLimit = opts.ipLimit ?? { limit: 20, windowMs: 60 * 60 * 1000 };
  const ipResult = await rateLimit(
    clientIp(req),
    `${opts.action}:ip`,
    ipLimit.limit,
    ipLimit.windowMs
  );
  if (!ipResult.allowed) return rateLimitResponse(ipResult.retryAfterSeconds);

  if (opts.email) {
    const emailLimit = opts.emailLimit ?? { limit: 5, windowMs: 60 * 60 * 1000 };
    const emailResult = await rateLimit(
      opts.email.toLowerCase().trim(),
      `${opts.action}:email`,
      emailLimit.limit,
      emailLimit.windowMs
    );
    if (!emailResult.allowed) return rateLimitResponse(emailResult.retryAfterSeconds);
  }

  return null;
}
