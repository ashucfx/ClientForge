// src/lib/authToken.ts

function base64UrlEncode(bytes: Uint8Array): string {
  const base64 =
    typeof btoa === 'function'
      ? (() => {
          let str = '';
          bytes.forEach(b => { str += String.fromCharCode(b); });
          return btoa(str);
        })()
      : Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(b64url: string): Uint8Array {
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

async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a[i] ^ b[i];
  return out === 0;
}

type SessionPayload = {
  v: 1;
  iat: number; // seconds
  exp: number; // seconds
};

export async function createSessionToken(secret: string, opts?: { ttlSeconds?: number }): Promise<string> {
  const ttlSeconds = opts?.ttlSeconds ?? 60 * 60 * 24 * 14; // 14 days
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { v: 1, iat: now, exp: now + ttlSeconds };
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const sigB64 = base64UrlEncode(await hmacSha256(secret, payloadB64));
  return `${payloadB64}.${sigB64}`;
}

export async function verifySessionToken(secret: string, token: string): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, sigB64] = parts;
  try {
    const expectedSig = await hmacSha256(secret, payloadB64);
    const actualSig = base64UrlDecode(sigB64);
    if (!timingSafeEqual(expectedSig, actualSig)) return false;
    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const payload = JSON.parse(payloadJson) as Partial<SessionPayload>;
    if (payload.v !== 1 || typeof payload.exp !== 'number') return false;
    const now = Math.floor(Date.now() / 1000);
    return payload.exp > now;
  } catch {
    return false;
  }
}
