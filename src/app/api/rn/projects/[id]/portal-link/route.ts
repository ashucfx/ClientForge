// src/app/api/rn/projects/[id]/portal-link/route.ts
// GET  — return the client's portal URL (generating a token if missing)
// POST — regenerate the token (invalidates the old link)

import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma as db } from '@/lib/db';
import { requireRnAdmin } from '@/lib/auth/rnAdmin';
import { logAudit } from '@/lib/audit/logger';

export const runtime = 'nodejs';

function portalUrl(token: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://clientforge.theripplenexus.com';
  return `${base}/rn/portal/${token}`;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireRnAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const client = await db.rnClient.findUnique({
    where: { id: params.id },
    select: { id: true, magicToken: true },
  });
  if (!client) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  let token = client.magicToken;
  if (!token) {
    token = randomBytes(32).toString('hex');
    await db.rnClient.update({ where: { id: client.id }, data: { magicToken: token } });
  }

  return NextResponse.json({ url: portalUrl(token), token });
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireRnAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const client = await db.rnClient.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!client) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const token = randomBytes(32).toString('hex');
  await db.rnClient.update({ where: { id: client.id }, data: { magicToken: token } });

  await logAudit(
    { tenantId: 'ripple_nexus', adminId: session.adminId, role: session.role, brandAccess: session.brandAccess },
    'PORTAL_LINK_REGENERATED',
    'RnClient',
    client.id,
    {}
  );

  return NextResponse.json({ url: portalUrl(token), token });
}
