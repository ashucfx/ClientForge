// src/app/api/career/portal/revisions/route.ts
// Client can GET their revision requests and POST a new revision request

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';
import { sendCareerEmail } from '@/lib/career/email';
import { notifyAllAdmins } from '@/lib/notifications';
import { waitUntil } from '@vercel/functions';


const ADMIN_EMAIL = process.env.ADMIN_NOTIFY_EMAIL ?? 'catalyst@theripplenexus.com';
const PORTAL_URL  =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'https://catalyst.theripplenexus.com');

async function getClient() {
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return null;
  const client = await db.careerClient.findUnique({
    where: { id: payload.clientId },
    select: { id: true, name: true, email: true, status: true, completedAt: true },
  });
  return client ?? null;
}

export async function GET() {
  const client = await getClient();
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const revisions = await db.careerRevision.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ revisions });
}

export async function POST(req: NextRequest) {
  const client = await getClient();
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (client.status === 'COMPLETED' && client.completedAt) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (client.completedAt < thirtyDaysAgo) {
      return NextResponse.json({ 
        error: 'Your 30-day revision window has expired. Please contact support for a new engagement.' 
      }, { status: 403 });
    }
  }

  const body      = await req.json().catch(() => null);
  const note      = (body?.note as string | undefined)?.trim();
  const fileLabel = (body?.fileLabel as string | undefined)?.trim() || undefined;
  const serviceSlug = (body?.serviceSlug as string | undefined)?.trim() || 'GENERAL';

  if (!note || note.length < 5) {
    return NextResponse.json({ error: 'Please describe the revision needed (min 5 chars).' }, { status: 400 });
  }
  if (note.length > 2000) {
    return NextResponse.json({ error: 'Note too long (max 2000 chars).' }, { status: 400 });
  }

  // Enforce max 2 FREE revision requests per service per client
  const FREE_LIMIT = 2;
  const existingFreeRevisions = await db.careerRevision.count({
    where: { 
      clientId: client.id, 
      requestedBy: 'client',
      serviceSlug,
      chargeStatus: 'FREE'
    },
  });

  const isFree = existingFreeRevisions < FREE_LIMIT;
  const chargeStatus = isFree ? 'FREE' : 'PENDING_PAYMENT';
  // If paid, we might lock the status as AWAITING_PAYMENT or keep it PENDING for admin review
  const status = isFree ? 'PENDING' : 'PENDING'; // Kept as PENDING for now so it shows up in admin queue

  const revision = await db.careerRevision.create({
    data: {
      clientId: client.id,
      requestedBy: 'client',
      note,
      fileLabel,
      serviceSlug,
      status,
      chargeStatus,
    },
  });

  // Log activity
  await db.careerActivityLog.create({
    data: {
      clientId: client.id,
      action: 'revision_requested',
      performedBy: 'client',
      metadata: { note: note.slice(0, 100), fileLabel, serviceSlug, chargeStatus },
    },
  });

  // Notify admin in-app (DB notification)
  waitUntil(
    notifyAllAdmins({
      title: `${isFree ? 'Revision' : 'Paid Revision'} requested by ${client.name}`,
      message: `[${serviceSlug}] "${note.slice(0, 100)}${note.length > 100 ? '…' : ''}"`,
      type: isFree ? 'WARNING' : 'ERROR', // ERROR color draws attention to pending payments
      link: `${PORTAL_URL}/career/${client.id}?tab=revisions`,
    }).catch(console.error)
  );

  // Notify admin via email
  const fileContext = fileLabel ? ` regarding "${fileLabel}"` : '';
  const pricingContext = isFree ? 'This is a free revision.' : '⚠️ The client has exhausted their free revisions for this service. A payment link needs to be generated.';
  
  waitUntil(
    sendCareerEmail({
      to: ADMIN_EMAIL,
      trigger: 'MESSAGE_NOTIFY',
      data: {
        recipientName: 'Catalyst Team',
        senderType: 'client',
        portalUrl: `${PORTAL_URL}/career/${client.id}?tab=revisions`,
        subject: `Catalyst — ${client.name} has requested a ${isFree ? '' : 'PAID '}revision`,
        body: `${client.name} has submitted a new revision request for ${serviceSlug}${fileContext}. \n\n${pricingContext}\n\nRequest: "${note.slice(0, 200)}${note.length > 200 ? '…' : ''}"`,
      },
    }).catch(console.error)
  );

  return NextResponse.json({ 
    ok: true, 
    revision,
    requiresPayment: !isFree,
    message: isFree ? 'Revision requested successfully.' : 'Free revisions exhausted for this service. Our team will review your request and send a payment link if a paid revision is required.'
  }, { status: 201 });
}
