import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const contacts = await db.contact.findMany({
      take: 100, // Limit for UI performance in v1
      orderBy: { createdAt: 'desc' },
      include: {
        flywheelProfile: true
      }
    });

    return NextResponse.json({ success: true, data: contacts });
  } catch (error) {
    console.error('[FlywheelLeads] GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
