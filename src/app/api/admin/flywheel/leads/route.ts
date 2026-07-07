import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { createWithGeneratedDisplayId, nextContactDisplayId } from '@/lib/displayIds';

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const search = url.searchParams.get('search') || '';
    const stage = url.searchParams.get('stage') || '';
    const status = url.searchParams.get('status') || '';
    const source = url.searchParams.get('source') || '';
    const sort = url.searchParams.get('sort') || 'displayId';
    const order = (url.searchParams.get('order') || 'desc') as 'asc' | 'desc';
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '25', 10), 100);

    // Build where clause
    const where: any = { status: 'ACTIVE' };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { industry: { contains: search, mode: 'insensitive' } },
        { displayId: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (stage) {
      where.flywheelProfile = { ...where.flywheelProfile, lifecycleStage: stage };
    }
    if (status) {
      where.flywheelProfile = { ...where.flywheelProfile, leadStatus: status };
    }
    if (source) {
      where.contactSource = source;
    }

    // Count total for pagination
    const total = await db.contact.count({ where });

    // Build orderBy
    let orderBy: any;
    if (sort === 'engagementScore') {
      orderBy = { flywheelProfile: { engagementScore: order } };
    } else if (sort === 'totalRevenue') {
      orderBy = { flywheelProfile: { totalRevenue: order } };
    } else {
      orderBy = { [sort]: order };
    }

    const contacts = await db.contact.findMany({
      where,
      include: {
        flywheelProfile: true,
        _count: {
          select: {
            careerClients: true,
            rnClients: true,
            flywheelCampaignLeads: true,
          }
        }
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return NextResponse.json({
      success: true,
      data: contacts,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      }
    });
  } catch (error) {
    console.error('[FlywheelLeads] GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, email, phone, companyName, industry, jobTitle, linkedinUrl, city, contactSource } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }

    // Normalise email: blank → null. Email is a UNIQUE column, and an empty
    // string is a real value — so a second email-less lead would collide on ''.
    // NULLs are distinct in a unique index, so multiple email-less leads are fine.
    const cleanEmail = typeof email === 'string' && email.trim()
      ? email.trim().toLowerCase()
      : null;

    // Reject a duplicate real email up front with a clear message
    if (cleanEmail) {
      const existing = await db.contact.findUnique({ where: { email: cleanEmail }, select: { id: true } });
      if (existing) {
        return NextResponse.json(
          { success: false, error: 'A contact with this email already exists.' },
          { status: 409 },
        );
      }
    }

    // Safe displayId generation — retry on P2002 collision (collision-safe)
    const contact = await db.$transaction(async (tx) => {
      return createWithGeneratedDisplayId(
        'displayId',
        () => nextContactDisplayId(tx),
        (displayId) => tx.contact.create({
          data: {
            displayId,
            name: String(name).trim(),
            email: cleanEmail,
            phone: phone || null,
            companyName: companyName || null,
            industry: industry || null,
            jobTitle: jobTitle || null,
            linkedinUrl: linkedinUrl || null,
            city: city || null,
            contactSource: contactSource || 'MANUAL',
            flywheelProfile: {
              create: { leadStatus: 'NEW', lifecycleStage: 'LEAD', optInSource: 'MANUAL_ENTRY' }
            },
          },
          include: { flywheelProfile: true },
        })
      );
    });

    return NextResponse.json({ success: true, data: contact });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'A contact with this email already exists.' },
        { status: 409 },
      );
    }
    console.error('[FlywheelLeads] POST Error:', error);
    return NextResponse.json({ success: false, error: 'Could not create lead. Please try again.' }, { status: 500 });
  }
}
