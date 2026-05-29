// src/lib/auth.ts
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { createSessionToken, verifySessionToken } from '@/lib/authToken';


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
  const salt = getAdminSessionSecret();
  return crypto.createHash('sha256').update(password + salt).digest('hex');
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
