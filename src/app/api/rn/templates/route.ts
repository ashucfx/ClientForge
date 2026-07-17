import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN and PROJECT_MANAGER can view templates typically, 
    // but we can just restrict to valid admins of ripple_nexus
    if (admin.role !== 'SUPER_ADMIN' && admin.role !== 'PROJECT_MANAGER' && admin.role !== 'SUPPORT_AGENT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
