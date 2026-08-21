// src/app/api/admin/referrals/options/route.ts
// Returns a lightweight list of clients and referral codes for invoice mapping.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // 1. Get Flywheel profiles that have a referralCode or contact
    const profiles = await db.flywheelProfile.findMany({
      select: {
        id: true,
        referralCode: true,
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });

    // 2. Also get Career Clients
    const careerClients = await db.careerClient.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        flywheelProfileId: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // Combine and deduplicate
    const map = new Map<string, { id: string; name: string; email: string; referralCode?: string }>();

    for (const p of profiles) {
      if (p.contact?.name) {
        map.set(p.contact.email.toLowerCase(), {
          id: p.id,
          name: p.contact.name,
          email: p.contact.email,
          referralCode: p.referralCode || undefined,
        });
      }
    }

    for (const c of careerClients) {
      if (c.name && c.email && !map.has(c.email.toLowerCase())) {
        map.set(c.email.toLowerCase(), {
          id: c.id,
          name: c.name,
          email: c.email,
        });
      }
    }

    const options = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ options });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch referrers' }, { status: 500 });
  }
}
