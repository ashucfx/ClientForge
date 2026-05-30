import { SignJWT, jwtVerify } from 'jose';

const RN_CLIENT_SECRET = new TextEncoder().encode(
  process.env.RN_CLIENT_SECRET || process.env.ADMIN_SESSION_SECRET || 'fallback-secret-for-dev'
);

export interface RnClientPayload {
  clientId: string;
  email: string;
}

export async function createRnClientSession(payload: RnClientPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(RN_CLIENT_SECRET);
}

export async function verifyRnClientSession(token: string): Promise<RnClientPayload | null> {
  try {
    const { payload } = await jwtVerify(token, RN_CLIENT_SECRET);
    return payload as unknown as RnClientPayload;
  } catch (err) {
    return null;
  }
}
