import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';
import { notifyAdmin } from '@/lib/notifications';
import { logSystemError } from '@/lib/audit/logger';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
    const payload = await verifyPortalToken(token);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    const { rating, npsScore, communication, deliveryQuality, turnaroundTime, comments, serviceType } = body;

    if (!rating || !npsScore || !communication || !deliveryQuality || !turnaroundTime || !serviceType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const client = await db.careerClient.findUnique({
      where: { id: payload.clientId }
    });

    if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Calculate delivery duration roughly if possible
    const deliveryDurationDays = client.completedAt ? 
      Math.round((client.completedAt.getTime() - client.createdAt.getTime()) / (1000 * 60 * 60 * 24)) : null;

    // Calculate revisions used
    const revisionCount = await db.careerRevision.count({ where: { clientId: client.id }});

    // Check if feedback already exists
    const existingFeedback = await db.feedback.findUnique({
      where: { careerClientId: client.id }
    });

    if (existingFeedback) {
      return NextResponse.json({ error: 'Feedback already submitted' }, { status: 400 });
    }

    const feedback = await db.feedback.create({
      data: {
        careerClientId: client.id,
        serviceType,
        rating,
        npsScore,
        communication,
        deliveryQuality,
        turnaroundTime,
        comments,
        deliveryDurationDays,
        revisionCount
      }
    });

    // AUTOMATION: Calculate Health Score using the true weighting algorithm
    // Rating: 40%
    // Communication: 20%
    // SLA (TurnaroundTime): 20%
    // Revisions: 20%

    const ratingScore = ((rating - 1) / 4) * 100;
    const commScore = ((communication - 1) / 4) * 100;
    const slaScore = ((turnaroundTime - 1) / 4) * 100;
    const revScore = Math.max(0, 100 - (revisionCount * 25));

    const healthScore = (ratingScore * 0.4) + (commScore * 0.2) + (slaScore * 0.2) + (revScore * 0.2);
    const satisfaction = ratingScore;
    
    let healthStatus = 'EXCELLENT';
    if (healthScore < 50) healthStatus = 'AT_RISK';
    else if (healthScore < 75) healthStatus = 'ATTENTION_NEEDED';
    else if (healthScore < 90) healthStatus = 'HEALTHY';

    await db.clientHealthScore.upsert({
      where: { careerClientId: client.id },
      create: {
        careerClientId: client.id,
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

    // AUTOMATION: Negative Feedback Escalation
    if (rating <= 3) {
      const adminUrl = `/admin/clients/${client.id}`;
      
      const admins = await db.adminUser.findMany({ select: { id: true } });
      for (const admin of admins) {
        await notifyAdmin({
          adminId: admin.id,
          title: '⚠️ Negative Feedback Alert',
          message: `${client.name} submitted a ${rating}-star rating. Immediate attention required.`,
          type: 'ERROR',
          link: adminUrl
        });
      }
    }

    return NextResponse.json({ success: true, feedback }, { status: 201 });
  } catch (err: any) {
    console.error('[Feedback API]', err);
    await logSystemError(err, 'FEEDBACK_API');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
