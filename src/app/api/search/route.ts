import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const isSuperAdmin   = session.role === 'SUPER_ADMIN';
    const activeTenant   = session.activeTenant;
    const showCatalyst   = isSuperAdmin || activeTenant === 'catalyst';
    const showRippleNexus = isSuperAdmin || activeTenant === 'ripple_nexus';

    const [careerClients, rnClients, invoices] = await Promise.all([
      showCatalyst
        ? prisma.careerClient.findMany({
            where: {
              OR: [
                { name:  { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
              ],
            },
            take: 5,
            select: { id: true, name: true, email: true, status: true },
          })
        : Promise.resolve([]),

      showRippleNexus
        ? prisma.rnClient.findMany({
            where: {
              OR: [
                { name:        { contains: query, mode: 'insensitive' } },
                { email:       { contains: query, mode: 'insensitive' } },
                { companyName: { contains: query, mode: 'insensitive' } },
              ],
            },
            take: 5,
            select: { id: true, name: true, email: true, companyName: true, currentStage: true },
          })
        : Promise.resolve([]),

      prisma.invoice.findMany({
        where: {
          ...(isSuperAdmin ? {} : { brandId: activeTenant }),
          OR: [
            { invoiceNumber: { contains: query, mode: 'insensitive' } },
            { clientName:    { contains: query, mode: 'insensitive' } },
          ],
        },
        take: 5,
        select: { id: true, invoiceNumber: true, clientName: true, status: true },
      }),
    ]);

    const results = [
      ...careerClients.map(c => ({
        type: 'Career Client',
        title: c.name,
        subtitle: c.email,
        url: `/career/${c.id}`,
        badge: c.status,
      })),
      ...rnClients.map(c => ({
        type: 'RN Project',
        title: c.companyName || c.name,
        subtitle: c.email,
        url: `/rn/projects/${c.id}`,
        badge: c.currentStage,
      })),
      ...invoices.map(i => ({
        type: 'Invoice',
        title: i.invoiceNumber,
        subtitle: i.clientName,
        url: `/invoices/${i.id}`,
        badge: i.status,
      })),
    ];

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Search API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
