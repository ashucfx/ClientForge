import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (admin.role !== 'SUPER_ADMIN' && admin.role !== 'PROJECT_MANAGER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    
    const whereClause: any = { isActive: true };
    if (category) whereClause.category = category;

    const templates = await prisma.rnServiceTemplate.findMany({
      where: whereClause,
      include: {
        milestoneTemplates: {
          orderBy: { order: 'asc' },
          include: { taskTemplates: true }
        },
        deliverableTemplates: true,
        onboardingTemplates: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ data: templates });
  } catch (error) {
    console.error('Failed to fetch service templates:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (admin.role !== 'SUPER_ADMIN' && admin.role !== 'PROJECT_MANAGER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, category, pricingModel, baseCurrency, taxRate, discountRules, termsAndConditions } = body;

    if (!name || !category) {
      return NextResponse.json({ error: 'Name and category are required' }, { status: 400 });
    }

    const newTemplate = await prisma.rnServiceTemplate.create({
      data: {
        name,
        description,
        category,
        pricingModel: pricingModel || 'FIXED',
        baseCurrency: baseCurrency || 'USD',
        taxRate: taxRate || 0,
        discountRules: discountRules || [],
        termsAndConditions,
        createdBy: admin.adminId,
      }
    });

    return NextResponse.json({ data: newTemplate }, { status: 201 });
  } catch (error) {
    console.error('Failed to create service template:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
