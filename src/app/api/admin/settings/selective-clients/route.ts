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

    // Query CareerClient, Contact, and RnClient for names and emails
    const [careerClients, contacts, rnClients] = await Promise.all([
      prisma.careerClient.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, name: true, email: true, phone: true },
      }),
      prisma.contact.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, name: true, email: true, phone: true },
      }),
      prisma.rnClient.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, name: true, email: true, phone: true },
      }),
    ]);

    const clientMap = new Map<string, { name: string; email: string | null; phone?: string | null }>();
    for (const c of careerClients) clientMap.set(c.id, c);
    for (const c of contacts) clientMap.set(c.id, c);
    for (const c of rnClients) clientMap.set(c.id, c);

    const results = clientIds.map(clientId => {
      const client = clientMap.get(clientId);
      const inrRow = settings.find(s => s.key === `CLIENT_PRICE_${clientId}_INR`);
      const usdRow = settings.find(s => s.key === `CLIENT_PRICE_${clientId}_USD`);
      const enabledRow = settings.find(s => s.key === `CLIENT_UPGRADE_ENABLED_${clientId}`);
      const infoRow = settings.find(s => s.key === `CLIENT_INFO_${clientId}`);

      const infoData = (infoRow?.value && typeof infoRow.value === 'object') ? (infoRow.value as { name?: string; email?: string; phone?: string }) : null;

      const clientName = client?.name ?? infoData?.name ?? 'Client #' + clientId.slice(0, 8);
      const clientEmail = client?.email ?? infoData?.email ?? '';
      const clientPhone = client?.phone ?? infoData?.phone ?? null;

      const priceInr = typeof inrRow?.value === 'number' ? inrRow.value : 0;
      const priceUsd = typeof usdRow?.value === 'number' ? usdRow.value : 0;
      const isExplicitlyEnabled = enabledRow ? Boolean(enabledRow.value) : (priceInr > 0 || priceUsd > 0);

      return {
        clientId,
        clientName,
        clientEmail,
        clientPhone,
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
            `CLIENT_INFO_${clientId}`,
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
