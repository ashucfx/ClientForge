import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'EDITOR')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { selectedIds } = await req.json();

    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

    const whereClause = selectedIds && selectedIds.length > 0 
        ? { contactId: { in: selectedIds } }
        : {};

    const profiles = await db.flywheelProfile.findMany({
      where: whereClause
    });

    let updatedCount = 0;

    // We do sequential updates to avoid massive transaction locks if thousands of leads
    for (const profile of profiles) {
      if (profile.lastContactedAt) {
        let newLifecycleStage = profile.lifecycleStage;
        let newLeadStatus = profile.leadStatus;
        let updated = false;

        // If they interacted in the last 6 months, they are a satiated CUSTOMER
        if (profile.lastContactedAt > sixMonthsAgo) {
          if (profile.lifecycleStage !== 'CUSTOMER' || profile.leadStatus !== 'CONTACTED') {
            newLifecycleStage = 'CUSTOMER';
            newLeadStatus = 'CONTACTED'; // They've been served, not ready for new pitches yet
            updated = true;
          }
        } else {
          // If it's been more than 6 months, they might be ready for a refresh/upsell
          if (profile.lifecycleStage !== 'LEAD' || profile.leadStatus !== 'NEW') {
            newLifecycleStage = 'LEAD';
            newLeadStatus = 'NEW'; // Drop them back into the new lead campaign pool!
            updated = true;
          }
        }

        if (updated) {
          await db.flywheelProfile.update({
            where: { id: profile.id },
            data: {
              lifecycleStage: newLifecycleStage,
              leadStatus: newLeadStatus
            }
          });
          updatedCount++;
        }
      }
    }

    return NextResponse.json({ success: true, updatedCount });

  } catch (error) {
    console.error('[AutoAssign] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
