import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const contact = await db.contact.findUnique({
    where: { id: params.id },
    include: {
      flywheelProfile: true,
      careerClients: {
        select: {
          id: true, packageType: true, lifecycleStatus: true,
          createdAt: true, updatedAt: true,
        },
      },
      rnClients: {
        select: {
          id: true, lifecycleStatus: true,
          createdAt: true, updatedAt: true,
        },
      },
      salesInquiries: {
        select: {
          id: true, requirementType: true, status: true, createdAt: true,
        },
      },
      flywheelCampaignLeads: {
        select: { id: true, status: true, createdAt: true },
      },
    },
  }) as any; // cast: TypeScript loses relation inference with nested selects

  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

  const invoices = await db.invoice.findMany({
    where: { clientEmail: contact.email ?? '' },
    select: {
      id: true, invoiceNumber: true, status: true,
      totalPayable: true, currency: true, createdAt: true, paidAt: true,
    },
  });

  const format = new URL(req.url).searchParams.get('format') ?? 'json';

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    contact: {
      id:            contact.id,
      displayId:     contact.displayId,
      name:          contact.name,
      email:         contact.email,
      phone:         contact.phone,
      companyName:   contact.companyName,
      city:          contact.city,
      country:       contact.country,
      industry:      contact.industry,
      jobTitle:      contact.jobTitle,
      linkedinUrl:   contact.linkedinUrl,
      contactSource: contact.contactSource,
      status:        contact.status,
      createdAt:     contact.createdAt,
    },
    marketingProfile: contact.flywheelProfile ? {
      optInStatus:     contact.flywheelProfile.optInStatus,
      optInSource:     contact.flywheelProfile.optInSource,
      optInIp:         contact.flywheelProfile.optInIp,
      lifecycleStage:  contact.flywheelProfile.lifecycleStage,
      leadStatus:      contact.flywheelProfile.leadStatus,
      engagementScore: contact.flywheelProfile.engagementScore,
      totalRevenue:    contact.flywheelProfile.totalRevenue,
      invoiceCount:    contact.flywheelProfile.invoiceCount,
      lastContactedAt: contact.flywheelProfile.lastContactedAt,
      tags:            contact.flywheelProfile.tags,
    } : null,
    careerClients:       contact.careerClients,
    rnClients:           contact.rnClients,
    salesInquiries:      contact.salesInquiries,
    invoices,
    campaignEnrollments: contact.flywheelCampaignLeads,
  };

  if (format === 'csv') {
    const rows = [
      ['Field', 'Value'],
      ['ID', exportPayload.contact.id],
      ['Name', exportPayload.contact.name],
      ['Email', exportPayload.contact.email ?? ''],
      ['Phone', exportPayload.contact.phone ?? ''],
      ['Company', exportPayload.contact.companyName ?? ''],
      ['City', exportPayload.contact.city ?? ''],
      ['Country', exportPayload.contact.country ?? ''],
      ['Industry', exportPayload.contact.industry ?? ''],
      ['Job Title', exportPayload.contact.jobTitle ?? ''],
      ['Contact Source', exportPayload.contact.contactSource ?? ''],
      ['Opt-In Status', String(exportPayload.marketingProfile?.optInStatus ?? '')],
      ['Opt-In Source', exportPayload.marketingProfile?.optInSource ?? ''],
      ['Total Revenue', String(exportPayload.marketingProfile?.totalRevenue ?? 0)],
      ['Invoice Count', String(exportPayload.marketingProfile?.invoiceCount ?? 0)],
    ];
    const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="contact-export-${params.id}.csv"`,
      },
    });
  }

  return NextResponse.json(exportPayload, {
    headers: {
      'Content-Disposition': `attachment; filename="contact-export-${params.id}.json"`,
    },
  });
}
