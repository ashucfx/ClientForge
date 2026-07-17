import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRnAdmin } from '@/lib/auth/rnAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const admin = await requireRnAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized or Forbidden' }, { status: 403 });
    }

    const templates = await prisma.rnServiceTemplate.findMany({
      where: { isActive: true },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    });

    // Group them by category
    const grouped = templates.reduce((acc: any, template: any) => {
      if (!acc[template.category]) {
        acc[template.category] = [];
      }
      acc[template.category].push({
        id: template.id,
        name: template.name,
        pricingModel: template.pricingModel,
        baseCurrency: template.baseCurrency
      });
      return acc;
    }, {});

    return NextResponse.json({ templates: grouped });
  } catch (err: any) {
    console.error('Failed to fetch RnServiceTemplates:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
