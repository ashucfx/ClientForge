// src/lib/career/auth.ts
// Portal JWT-like token auth — uses jose for secure JWTs, falls back to legacy HMAC for existing clients

import { SignJWT, jwtVerify } from 'jose';


const COOKIE_NAME = 'cf_portal';
const DEFAULT_TTL = 60 * 60 * 24 * 7; // 7 days
const MAGIC_TTL   = 60 * 30;          // 30 minutes for magic links

function getSecret(): string {
  const s = process.env.CAREER_PORTAL_SECRET;
  if (!s) throw new Error('CAREER_PORTAL_SECRET is not configured');
  return s;
}

function b64urlEncode(bytes: Uint8Array): string {
  const base64 =
    typeof btoa === 'function'
      ? (() => { let s = ''; bytes.forEach(b => { s += String.fromCharCode(b); }); return btoa(s); })()
      : Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlDecode(b64url: string): Uint8Array {
  const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url + pad).replace(/-/g, '+').replace(/_/g, '/');
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)));
}

function timingSafe(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a[i] ^ b[i];
  return out === 0;
}

// ── Portal Session Token ─────────────────────────────────────────────────────

export interface PortalPayload {
  clientId: string;
  email: string;
  iat: number;
  exp: number;
}

export async function createPortalToken(clientId: string, email: string): Promise<string> {
  const secret = getSecret();
  const now = Math.floor(Date.now() / 1000);
  
  return new SignJWT({ clientId, email, v: 2 })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + DEFAULT_TTL)
    .sign(new TextEncoder().encode(secret));
}


export async function verifyPortalToken(token: string): Promise<PortalPayload | null> {
  try {
    const secret = getSecret();
    
    // 1. Try standard jose JWT verification first
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] });
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
      return payload as unknown as PortalPayload;
    } catch (joseError) {
      // 2. Fall back to legacy HMAC-SHA256 logic for existing sessions (Zero-Downtime Migration)
      const parts = token.split('.');
      if (parts.length !== 2) return null;
      const [payloadB64, sigB64] = parts;
      const expected = await hmac(secret, payloadB64);
      if (!timingSafe(expected, b64urlDecode(sigB64))) return null;
      
      const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64))) as PortalPayload;
      if (Math.floor(Date.now() / 1000) > payload.exp) return null;
      return payload;
    }
  } catch {
    return null;
  }
}


// ── Magic Link Token (short-lived, one-time) ─────────────────────────────────

export function generateMagicToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function magicTokenExpiry(): Date {
  return new Date(Date.now() + MAGIC_TTL * 1000);
}

// ── Cookie helpers ────────────────────────────────────────────────────────────

export const PORTAL_COOKIE = COOKIE_NAME;

export function portalCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: DEFAULT_TTL,
  };
}
