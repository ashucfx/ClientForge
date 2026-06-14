import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { evaluateAllContacts } from '@/lib/flywheel/actionEngine';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const triggerEval = searchParams.get('eval') === 'true';

    // In a real production system, this would be a CRON job. 
    // For this demonstration, we allow forcing an evaluation via query param.
    if (triggerEval) {
      await evaluateAllContacts();
    }

    const actions = await db.flywheelActionCard.findMany({
      where: { status: 'PENDING' },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ],
      include: {
        contact: {
          select: { name: true, email: true, companyName: true }
        }
      }
    });

    return NextResponse.json({ success: true, data: actions });
  } catch (error) {
    console.error('[ActionAPI] GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { actionId, status } = body;

    if (!actionId || !['APPROVED', 'DISMISSED', 'EXECUTED'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }

    const action = await db.flywheelActionCard.findUnique({ where: { id: actionId } });
    if (!action) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    // If executed, we could wire up `marketingMailer.ts` here to auto-send an email
    // For now, we simply transition the state.
    if (status === 'EXECUTED') {
      console.log(`[ActionAPI] Executing Action: ${action.suggestedAction} for Contact: ${action.contactId}`);
      // e.g. await sendMarketingEmail(...)
    }

    const updated = await db.flywheelActionCard.update({
      where: { id: actionId },
      data: { status }
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[ActionAPI] POST Error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
