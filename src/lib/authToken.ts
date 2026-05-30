// src/lib/authToken.ts

import { SignJWT, jwtVerify, JWTPayload } from 'jose';

const ALGORITHM = 'HS256';

export interface AdminSessionPayload extends JWTPayload {
  adminId: string;
  email: string;
  role: string;
  /** The brand the admin actively logged into — cryptographically embedded, cannot be tampered */
  activeTenant?: string;
  /** All brands this admin has access to */
  brandAccess?: string[];
}

function getSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(
  secret: string,
  payload: { adminId: string; email: string; role: string; activeTenant?: string; brandAccess?: string[] },
  opts?: { ttlSeconds?: number }
): Promise<string> {
  const ttlSeconds = opts?.ttlSeconds ?? 60 * 60 * 24 * 14; // 14 days
  const now = Math.floor(Date.now() / 1000);
  
  return new SignJWT({ ...payload, v: 3 })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(getSecretKey(secret));
}

export async function verifySessionToken(
  secret: string,
  token: string
): Promise<AdminSessionPayload | null> {
  if (!token) return null;
  
  try {
    const { payload } = await jwtVerify(token, getSecretKey(secret), {
      algorithms: [ALGORITHM],
    });
    
    // Ensure it's not expired (jwtVerify does this, but we can be explicit)
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    return payload as AdminSessionPayload;
  } catch (error) {
    // If it fails to verify (invalid signature, expired, etc), return null
    return null;
  }
}
