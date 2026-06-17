// src/app/api/admin/referrals/route.ts
// Admin API: list all contacts who have referrals, with conversion + revenue stats.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { tenantApiGuard } from '@/lib/tenant/guard';

export async function GET(req: NextRequest) {
  const guard = await tenantApiGuard(req, 'catalyst');
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.trim() ?? '';

  // All FlywheelProfiles that have at least one referred profile
  const referrers = await db.flywheelProfile.findMany({
    where: {
      referrals: { some: {} },
      ...(search
        ? {
            contact: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    },
    select: {
      id: true,
      referralCode: true,
      contact: { select: { id: true, name: true, email: true } },
      referrals: {
        select: {
          id: true,
          lifecycleStage: true,
          totalRevenue: true,
          contact: { select: { id: true, name: true, email: true, createdAt: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });

  const data = referrers.map((r) => {
    const totalRevenue = r.referrals.reduce(
      (sum, ref) => sum + Number(ref.totalRevenue ?? 0),
      0
    );
    const convertedCount = r.referrals.filter(
      (ref) => ref.lifecycleStage === 'CUSTOMER'
    ).length;

    return {
      referrerId: r.contact.id,
      referrerName: r.contact.name,
      referrerEmail: r.contact.email,
      referralCode: r.referralCode,
      totalReferrals: r.referrals.length,
      convertedCount,
      totalRevenue,
      referrals: r.referrals.map((ref) => ({
        contactId: ref.contact.id,
        name: ref.contact.name,
        email: ref.contact.email,
        joinedAt: ref.contact.createdAt,
        isConverted: ref.lifecycleStage === 'CUSTOMER',
        revenue: Number(ref.totalRevenue ?? 0),
      })),
    };
  });

  return NextResponse.json({ referrers: data, total: data.length });
}
