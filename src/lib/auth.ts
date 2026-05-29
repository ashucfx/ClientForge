// src/lib/auth.ts
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import crypto from 'crypto';
import { createSessionToken, verifySessionToken } from '@/lib/authToken';

export function verifyCsrf(req: NextRequest): boolean {
  // Enforce application/json for API routes (forces preflight CORS check, mitigating simple POST CSRF)
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.includes('application/json') && !contentType.includes('multipart/form-data')) {
    return false;
  }

  // Strict Origin verification
  const origin = req.headers.get('origin');
  const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL;
  if (origin && allowedOrigin && origin !== allowedOrigin && origin !== allowedOrigin.replace('http://', 'https://')) {
    return false;
  }

  return true;
}


const COOKIE_NAME = 'cf_admin';

export function getAdminSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('ADMIN_SESSION_SECRET env var is required');
  return secret;
}

export function getAdminPassword(): string {
  const pwd = process.env.ADMIN_PASSWORD;
  if (!pwd) throw new Error('ADMIN_PASSWORD env var is required');
  return pwd;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  // Backwards compatibility for old SHA-256 hashes (which don't contain a colon)
  if (!stored.includes(':')) {
    const salt = getAdminSessionSecret();
    const legacyHash = crypto.createHash('sha256').update(password + salt).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(stored, 'utf8'), Buffer.from(legacyHash, 'utf8'));
    } catch {
      return false;
    }
  }

  // New scrypt verification
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  
  const attempt = crypto.scryptSync(password, salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'utf8'), Buffer.from(attempt, 'utf8'));
  } catch {
    return false;
  }
}

export async function createAdminSessionToken(
  payload: { adminId: string; email: string; role: string },
  opts?: { ttlSeconds?: number }
): Promise<string> {
  const configuredTtl = process.env.ADMIN_SESSION_TTL_SECONDS
    ? Number(process.env.ADMIN_SESSION_TTL_SECONDS)
    : undefined;
  const ttlSeconds =
    typeof opts?.ttlSeconds === 'number'
      ? opts.ttlSeconds
      : (Number.isFinite(configuredTtl) && (configuredTtl as number) > 0 ? (configuredTtl as number) : 60 * 60 * 8); // 8 hours default

  return createSessionToken(getAdminSessionSecret(), payload, { ttlSeconds });
}


export async function verifyAdminSessionToken(token: string): Promise<boolean> {
  const payload = await verifySessionToken(getAdminSessionSecret(), token);
  return payload !== null;
}

export async function isAdminRequest(): Promise<boolean> {
  try {
    const token = cookies().get(COOKIE_NAME)?.value;
    if (!token) return false;
    return verifyAdminSessionToken(token);
  } catch {
    return false;
  }
}

export function getAdminCookieName(): string {
  return COOKIE_NAME;
}
