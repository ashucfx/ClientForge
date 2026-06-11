import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { notifyAdmin } from '@/lib/notifications';
import { verifyRnClientSession } from '@/lib/rn/auth';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const tokenCookie = cookies().get('rn_client_session')?.value;
  const session = tokenCookie ? await verifyRnClientSession(tokenCookie) : null;
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const { rating, npsScore, communication, deliveryQuality, turnaroundTime, comments, serviceType } = body;

  if (!rating || !npsScore || !communication || !deliveryQuality || !turnaroundTime || !serviceType) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const client = await db.rnClient.findUnique({
    where: { id: session.clientId }
  });

  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Check if feedback already exists
  const existingFeedback = await db.feedback.findUnique({
    where: { rnClientId: client.id }
  });

  if (existingFeedback) {
    return NextResponse.json({ error: 'Feedback already submitted' }, { status: 400 });
  }

  const feedback = await db.feedback.create({
    data: {
      rnClientId: client.id,
      serviceType,
      rating,
      npsScore,
      communication,
      deliveryQuality,
      turnaroundTime,
      comments,
    }
  });

  const satisfaction = rating * 20; 
  const healthScore = (satisfaction * 0.4) + 60; 
  
  let healthStatus = 'EXCELLENT';
  if (healthScore < 50) healthStatus = 'AT_RISK';
  else if (healthScore < 75) healthStatus = 'ATTENTION_NEEDED';
  else if (healthScore < 90) healthStatus = 'HEALTHY';

  await db.clientHealthScore.upsert({
    where: { rnClientId: client.id },
    create: {
      rnClientId: client.id,
      score: healthScore,
      satisfaction,
      status: healthStatus
    },
    update: {
      score: healthScore,
      satisfaction,
      status: healthStatus,
      lastCalculatedAt: new Date()
    }
  });

  if (rating <= 3) {
    const adminUrl = `/rn/clients/${client.id}`;
    const admins = await db.adminUser.findMany({ select: { id: true } });
    for (const admin of admins) {
      await notifyAdmin({
        adminId: admin.id,
        title: '⚠️ Negative Feedback Alert (RN)',
        message: `${client.name} submitted a ${rating}-star rating. Immediate attention required.`,
        type: 'ERROR',
        link: adminUrl
      });
    }
  }

  return NextResponse.json({ success: true, feedback }, { status: 201 });
}
