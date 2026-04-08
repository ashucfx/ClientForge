// src/lib/auth.ts

import { cookies } from 'next/headers';
import { createSessionToken, verifySessionToken } from '@/lib/authToken';

const COOKIE_NAME = 'cf_admin';

export function getAdminSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_SECRET ?? '';
  if (!secret) {
    throw new Error('Missing ADMIN_SESSION_SECRET (or ADMIN_SECRET)');
  }
  return secret;
}

export function getAdminPassword(): string {
  const pwd = process.env.ADMIN_PASSWORD ?? process.env.ADMIN_SECRET ?? '';
  if (!pwd) {
    throw new Error('Missing ADMIN_PASSWORD (or ADMIN_SECRET)');
  }
  return pwd;
}

export async function createAdminSessionToken(opts?: { ttlSeconds?: number }): Promise<string> {
  return createSessionToken(getAdminSessionSecret(), opts);
}

export async function verifyAdminSessionToken(token: string): Promise<boolean> {
  return verifySessionToken(getAdminSessionSecret(), token);
}

export async function isAdminRequest(): Promise<boolean> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyAdminSessionToken(token);
}

export function getAdminCookieName(): string {
  return COOKIE_NAME;
}
