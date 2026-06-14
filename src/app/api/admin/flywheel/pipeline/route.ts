import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const search = url.searchParams.get('search') || '';
    const industry = url.searchParams.get('industry') || '';
    const source = url.searchParams.get('source') || '';
    const sort = url.searchParams.get('sort') || 'createdAt';
    const order = url.searchParams.get('order') || 'desc';

    // Build where clause
    const where: any = { status: 'ACTIVE' };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (industry) where.industry = industry;
    if (source) where.contactSource = source;

    // Fetch all contacts with flywheel profile
    const contacts = await db.contact.findMany({
      where,
      include: {
        flywheelProfile: true,
        _count: {
          select: {
            careerClients: true,
            rnClients: true,
          }
        }
      },
      orderBy: sort === 'engagementScore'
        ? { flywheelProfile: { engagementScore: order as any } }
        : { [sort]: order },
      take: 200,
    });

    // Group by lifecycle stage
    const stages = ['SUBSCRIBER', 'LEAD', 'MQL', 'SQL', 'CUSTOMER', 'CHURNED'];
    const pipeline: Record<string, any[]> = {};
    for (const stage of stages) {
      pipeline[stage] = [];
    }

    for (const contact of contacts) {
      const stage = contact.flywheelProfile?.lifecycleStage || 'LEAD';
      if (!pipeline[stage]) pipeline[stage] = [];
      pipeline[stage].push({
        id: contact.id,
        displayId: contact.displayId,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        companyName: contact.companyName,
        industry: contact.industry,
        jobTitle: contact.jobTitle,
        contactSource: contact.contactSource,
        createdAt: contact.createdAt,
        lifecycleStage: stage,
        leadStatus: contact.flywheelProfile?.leadStatus || 'NEW',
        engagementScore: contact.flywheelProfile?.engagementScore || 0,
        totalRevenue: Number(contact.flywheelProfile?.totalRevenue || 0),
        lastContactedAt: contact.flywheelProfile?.lastContactedAt,
        lastInvoiceDate: contact.flywheelProfile?.lastInvoiceDate,
        invoiceCount: contact.flywheelProfile?.invoiceCount || 0,
        linkedClients: contact._count.careerClients + contact._count.rnClients,
      });
    }

    // Compute stage counts
    const stageCounts: Record<string, number> = {};
    for (const [stage, items] of Object.entries(pipeline)) {
      stageCounts[stage] = items.length;
    }

    return NextResponse.json({
      success: true,
      data: {
        pipeline,
        stageCounts,
        totalContacts: contacts.length,
      }
    });
  } catch (error) {
    console.error('[FlywheelPipeline] GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
