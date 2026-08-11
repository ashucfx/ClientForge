// src/app/api/admin/settings/selective-clients/route.ts
// GET — returns list of clients with selective pricing overrides enabled
// DELETE — remove selective pricing override for a client (SUPER_ADMIN only)

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  void req;
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find all settings keys matching CLIENT_PRICE_* or CLIENT_UPGRADE_ENABLED_*
    const settings = await prisma.systemSetting.findMany({
      where: {
        OR: [
          { key: { startsWith: 'CLIENT_PRICE_' } },
          { key: { startsWith: 'CLIENT_UPGRADE_ENABLED_' } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Extract unique client IDs
    const clientIdsSet = new Set<string>();
    for (const s of settings) {
      const match = s.key.match(/^(?:CLIENT_PRICE_|CLIENT_UPGRADE_ENABLED_)([a-zA-Z0-9_-]+?)(?:_(?:INR|USD))?$/);
      if (match && match[1]) clientIdsSet.add(match[1]);
    }

    const clientIds = Array.from(clientIdsSet);
    if (clientIds.length === 0) {
      return NextResponse.json({ clients: [] });
    }

    // Query CareerClient for names and emails
    const careerClients = await prisma.careerClient.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true, email: true, phone: true, packageType: true },
    });

    const clientMap = new Map(careerClients.map(c => [c.id, c]));

    const results = clientIds.map(clientId => {
      const client = clientMap.get(clientId);
      const inrRow = settings.find(s => s.key === `CLIENT_PRICE_${clientId}_INR`);
      const usdRow = settings.find(s => s.key === `CLIENT_PRICE_${clientId}_USD`);
      const enabledRow = settings.find(s => s.key === `CLIENT_UPGRADE_ENABLED_${clientId}`);

      const priceInr = typeof inrRow?.value === 'number' ? inrRow.value : 0;
      const priceUsd = typeof usdRow?.value === 'number' ? usdRow.value : 0;
      const isExplicitlyEnabled = enabledRow ? Boolean(enabledRow.value) : (priceInr > 0 || priceUsd > 0);

      return {
        clientId,
        clientName: client?.name ?? 'Unknown Client',
        clientEmail: client?.email ?? '',
        clientPhone: client?.phone ?? null,
        priceInr,
        priceUsd,
        enabled: isExplicitlyEnabled,
        updatedAt: inrRow?.updatedAt ?? usdRow?.updatedAt ?? enabledRow?.updatedAt ?? new Date(),
      };
    });

    return NextResponse.json({ clients: results });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch selective clients';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden — SUPER_ADMIN role required' }, { status: 403 });
  }

  const clientId = req.nextUrl.searchParams.get('clientId');
  if (!clientId) {
    return NextResponse.json({ error: 'clientId query parameter is required' }, { status: 400 });
  }

  try {
    await prisma.systemSetting.deleteMany({
      where: {
        key: {
          in: [
            `CLIENT_PRICE_${clientId}_INR`,
            `CLIENT_PRICE_${clientId}_USD`,
            `CLIENT_UPGRADE_ENABLED_${clientId}`,
          ],
        },
      },
    });

    return NextResponse.json({ ok: true, clientId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete client selective pricing';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
