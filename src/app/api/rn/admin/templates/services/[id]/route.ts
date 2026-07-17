import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const template = await prisma.rnServiceTemplate.findUnique({
      where: { id: params.id },
      include: {
        milestoneTemplates: {
          orderBy: { order: 'asc' },
          include: { taskTemplates: true }
        },
        deliverableTemplates: true,
        onboardingTemplates: true,
      }
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ data: template });
  } catch (error) {
    console.error('Failed to fetch template:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (admin.role !== 'SUPER_ADMIN' && admin.role !== 'PROJECT_MANAGER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    
    // Instead of updating the existing, we archive the old and create a new version (v2)
    // if the user requested versioning, but for simplicity here we just update if it's a minor change,
    // or we create a new version if instructed. Let's do basic update first, versioning can be explicit.
    
    const { name, description, category, pricingModel, baseCurrency, taxRate, discountRules, termsAndConditions, createNewVersion } = body;

    const existing = await prisma.rnServiceTemplate.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    if (createNewVersion) {
      // Archive the old one
      await prisma.rnServiceTemplate.update({
        where: { id: params.id },
        data: { isActive: false }
      });

      // Create new one with version bumped
      const newTemplate = await prisma.rnServiceTemplate.create({
        data: {
          name: name ?? existing.name,
          description: description ?? existing.description,
          category: category ?? existing.category,
          pricingModel: pricingModel ?? existing.pricingModel,
          baseCurrency: baseCurrency ?? existing.baseCurrency,
          taxRate: taxRate ?? existing.taxRate,
          discountRules: discountRules ?? existing.discountRules,
          termsAndConditions: termsAndConditions ?? existing.termsAndConditions,
          version: existing.version + 1,
          originalId: existing.originalId || existing.id,
          createdBy: admin.id,
        }
      });
      return NextResponse.json({ data: newTemplate }, { status: 201 });
    } else {
      // Direct update
      const updatedTemplate = await prisma.rnServiceTemplate.update({
        where: { id: params.id },
        data: {
          name, description, category, pricingModel, baseCurrency, taxRate, discountRules, termsAndConditions
        }
      });
      return NextResponse.json({ data: updatedTemplate }, { status: 200 });
    }
  } catch (error) {
    console.error('Failed to update template:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (admin.role !== 'SUPER_ADMIN' && admin.role !== 'PROJECT_MANAGER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Soft delete (archive)
    const archived = await prisma.rnServiceTemplate.update({
      where: { id: params.id },
      data: { isActive: false }
    });

    return NextResponse.json({ data: archived });
  } catch (error) {
    console.error('Failed to archive template:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
