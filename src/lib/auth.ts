// src/lib/auth.ts
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import crypto from 'crypto';
import { promisify } from 'util';
import { createSessionToken, verifySessionToken } from '@/lib/authToken';

const scryptAsync = promisify(crypto.scrypt);

export function verifyCsrf(req: NextRequest): boolean {
  // Enforce application/json for API routes (forces preflight CORS check, mitigating simple POST CSRF)
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.includes('application/json') && !contentType.includes('multipart/form-data')) {
    return false;
  }

  // Strict Origin verification
  const origin = req.headers.get('origin');
  const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL;

  if (origin) {
    // If the request carries an Origin header, we MUST validate it.
    // Reject if NEXT_PUBLIC_APP_URL is not configured — do not silently pass.
    if (!allowedOrigin) {
      console.error('[CSRF] NEXT_PUBLIC_APP_URL is not set — rejecting cross-origin request');
      return false;
    }
    const isExact = origin === allowedOrigin || origin === allowedOrigin.replace('http://', 'https://');
    const isWww   = origin === allowedOrigin.replace('https://', 'https://www.') || origin === allowedOrigin.replace('http://', 'http://www.');
    if (!isExact && !isWww) {
      return false;
    }
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

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  const hash = derivedKey.toString('hex');
  return `${salt}:${hash}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
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
  
  try {
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    const attempt = derivedKey.toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'utf8'), Buffer.from(attempt, 'utf8'));
  } catch {
    return false;
  }
}

export async function createAdminSessionToken(
  payload: { adminId: string; email: string; role: string; brandAccess: string[]; activeTenant: string },
  opts?: { ttlSeconds?: number }
): Promise<string> {
  const configuredTtl = process.env.ADMIN_SESSION_TTL_SECONDS
    ? Number(process.env.ADMIN_SESSION_TTL_SECONDS)
    : undefined;
  const ttlSeconds =
    typeof opts?.ttlSeconds === 'number'
      ? opts.ttlSeconds
      : (Number.isFinite(configuredTtl) && (configuredTtl as number) > 0 ? (configuredTtl as number) : 60 * 60 * 8); // 8 hours default

  return createSessionToken(getAdminSessionSecret(), { ...payload, activeTenant: payload.activeTenant }, { ttlSeconds });
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

export async function getAdminSession(): Promise<{ adminId: string; role: string; brandAccess: string[]; activeTenant: string } | null> {
  try {
    const token = cookies().get(COOKIE_NAME)?.value;
    if (!token) return null;
    const payload = await verifySessionToken(getAdminSessionSecret(), token);
    if (!payload) return null;
    // Derive activeTenant from JWT first (v3+), fall back to first brand in brandAccess for legacy tokens
    const brandAccess = Array.isArray(payload.brandAccess) ? payload.brandAccess : [];
    let activeTenant = payload.activeTenant as string;
    if (!activeTenant) {
      activeTenant = brandAccess.includes('catalyst') ? 'catalyst' : (brandAccess[0] ?? 'catalyst');
    }
    return {
      adminId: payload.adminId,
      role: payload.role,
      brandAccess,
      activeTenant,
    };
  } catch {
    return null;
  }
}

export function getAdminCookieName(): string {
  return COOKIE_NAME;
}
