// src/app/api/career/admin/clients/[id]/messages/route.ts
// Admin: GET all messages, POST send message

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { sendCareerEmail } from '@/lib/career/email';
import { waitUntil } from '@vercel/functions';


const PORTAL_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'https://catalyst.theripplenexus.com');

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const messages = await db.careerMessage.findMany({
    where: { clientId: params.id },
    orderBy: { createdAt: 'asc' },
  });

  // Mark all client messages as read by admin
  await db.careerMessage.updateMany({
    where: { clientId: params.id, authorType: 'client', readByAdmin: false },
    data: { readByAdmin: true },
  });

  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const content = body?.content ? String(body.content).trim() : '';
  if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 });

  const client = await db.careerClient.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, email: true },
  });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const message = await db.careerMessage.create({
    data: {
      clientId: client.id,
      authorType: 'admin',
      authorName: 'Catalyst Team',
      content,
      readByAdmin: true,
    },
  });

  // Email notification to client
  const portalUrl = `${PORTAL_URL}/portal/dashboard`;
  waitUntil(
    sendCareerEmail({
      to: client.email,
      trigger: 'MESSAGE_NOTIFY',
      data: { recipientName: client.name, senderType: 'admin', portalUrl },
    }).catch(console.error)
  );

  return NextResponse.json({ message }, { status: 201 });
}
