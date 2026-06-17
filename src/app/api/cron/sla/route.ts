import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { notifyAllAdmins } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // 1. Career Clients SLA checks
    const upcomingCareer = await prisma.careerClient.findMany({
      where: {
        slaDeadline: {
          lte: threeDaysFromNow,
          gt: now
        },
        slaStatus: { not: 'COMPLETED' },
        status: { notIn: ['COMPLETED'] }
      },
    });

    for (const client of upcomingCareer) {
      await notifyAllAdmins({
        title: 'SLA Warning: Career Client',
        message: `Client ${client.name} SLA deadline is approaching on ${client.slaDeadline?.toLocaleDateString()}`,
        type: 'WARNING',
        link: `/career/${client.id}`
      });
    }

    const breachedCareer = await prisma.careerClient.findMany({
      where: {
        slaDeadline: { lte: now },
        slaStatus: { not: 'COMPLETED' },
        status: { notIn: ['COMPLETED'] }
      },
    });

    for (const client of breachedCareer) {
      await notifyAllAdmins({
        title: 'SLA BREACHED: Career Client',
        message: `Client ${client.name} SLA deadline has passed!`,
        type: 'ERROR',
        link: `/career/${client.id}`
      });
    }

    // 2. Ripple Nexus Clients SLA checks
    const upcomingRn = await prisma.rnClient.findMany({
      where: {
        slaDeadline: {
          lte: threeDaysFromNow,
          gt: now
        },
        slaStatus: { not: 'COMPLETED' }
      },
    });

    for (const client of upcomingRn) {
      await notifyAllAdmins({
        title: 'SLA Warning: Ripple Nexus Project',
        message: `Project for ${client.companyName || client.name} SLA deadline is approaching on ${client.slaDeadline?.toLocaleDateString()}`,
        type: 'WARNING',
        link: `/rn/projects/${client.id}`
      });
    }

    const breachedRn = await prisma.rnClient.findMany({
      where: {
        slaDeadline: { lte: now },
        slaStatus: { not: 'COMPLETED' }
      },
    });

    for (const client of breachedRn) {
      await notifyAllAdmins({
        title: 'SLA BREACHED: Ripple Nexus Project',
        message: `Project for ${client.companyName || client.name} SLA deadline has passed!`,
        type: 'ERROR',
        link: `/rn/projects/${client.id}`
      });
    }

    // 3. Inactivity checks (e.g. inactive for 7 days)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const inactiveCareer = await prisma.careerClient.findMany({
      where: {
        lastLoginAt: { lte: sevenDaysAgo },
        status: { notIn: ['COMPLETED', 'NOT_STARTED'] }
      },
    });

    for (const client of inactiveCareer) {
      await notifyAllAdmins({
        title: 'Client Inactive',
        message: `Client ${client.name} has not logged in for over 7 days.`,
        type: 'INFO',
        link: `/career/${client.id}`
      });
    }

    // 4. Auto-approve Career Deliverables (Pending for > 2 Days, not yet auto-approved)
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const pendingDeliverables = await prisma.careerDeliverable.findMany({
      where: {
        fileCategory: 'final',
        approvalStatus: 'PENDING',
        approvedAt: null,         // guard: skip if approvedAt is already set
        createdAt: { lte: twoDaysAgo, gt: new Date(0) }
      },
      include: { client: true }
    });

    for (const file of pendingDeliverables) {
      // updateMany with approvalStatus filter prevents double-approval in concurrent runs
      const result = await prisma.careerDeliverable.updateMany({
        where: { id: file.id, approvalStatus: 'PENDING', approvedAt: null },
        data: { approvalStatus: 'APPROVED', approvedAt: now }
      });
      if (result.count === 0) continue; // another worker got there first

      // Log the activity
      await prisma.careerActivityLog.create({
        data: {
          clientId: file.clientId,
          action: 'deliverable_auto_approved',
          performedBy: 'system',
          metadata: { fileId: file.id, fileLabel: file.label, autoApproved: true }
        }
      });
      
      // Notify Admin
      await notifyAllAdmins({
        title: 'Deliverable Auto-Approved',
        message: `${file.label} for ${file.client.name} was auto-approved after 48 hours.`,
        type: 'INFO',
        link: `/career/${file.clientId}`
      });
    }

    return NextResponse.json({ 
      success: true, 
      processed: {
        upcomingCareer: upcomingCareer.length,
        breachedCareer: breachedCareer.length,
        upcomingRn: upcomingRn.length,
        breachedRn: breachedRn.length,
        inactiveCareer: inactiveCareer.length,
        autoApprovedFiles: pendingDeliverables.length
      } 
    });

  } catch (error) {
    console.error('SLA Cron Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
