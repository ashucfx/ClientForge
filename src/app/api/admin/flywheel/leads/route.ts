import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const contacts = await db.contact.findMany({
      take: 100, // Limit for UI performance in v1
      orderBy: { createdAt: 'desc' },
      include: {
        flywheelProfile: true
      }
    });

    return NextResponse.json({ success: true, data: contacts });
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

    if (!name) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }

    // Auto-generate display ID
    const count = await db.contact.count();
    const displayId = `LD-${1000 + count + 1}`;

    const contact = await db.contact.create({
      data: {
        displayId,
        name,
        email,
        phone,
        companyName,
        industry,
        jobTitle,
        linkedinUrl,
        city,
        contactSource: contactSource || 'MANUAL',
        flywheelProfile: {
          create: {
            leadStatus: 'NEW',
            lifecycleStage: 'LEAD',
            optInSource: 'MANUAL_ENTRY'
          }
        }
      },
      include: { flywheelProfile: true }
    });

    return NextResponse.json({ success: true, data: contact });
  } catch (error) {
    console.error('[FlywheelLeads] POST Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
