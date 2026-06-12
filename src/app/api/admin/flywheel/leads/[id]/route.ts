import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const contact = await db.contact.findUnique({
      where: { id: params.id },
      include: { flywheelProfile: true }
    });

    if (!contact) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: contact });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    
    // Split updates into Contact vs FlywheelProfile
    const { 
      name, email, phone, companyName, industry, jobTitle, linkedinUrl, city, contactSource, // Contact
      leadStatus, lifecycleStage, nextActionDate, optInSource // FlywheelProfile
    } = body;

    const contactUpdate: any = {};
    if (name !== undefined) contactUpdate.name = name;
    if (email !== undefined) contactUpdate.email = email;
    if (phone !== undefined) contactUpdate.phone = phone;
    if (companyName !== undefined) contactUpdate.companyName = companyName;
    if (industry !== undefined) contactUpdate.industry = industry;
    if (jobTitle !== undefined) contactUpdate.jobTitle = jobTitle;
    if (linkedinUrl !== undefined) contactUpdate.linkedinUrl = linkedinUrl;
    if (city !== undefined) contactUpdate.city = city;
    if (contactSource !== undefined) contactUpdate.contactSource = contactSource;

    const profileUpdate: any = {};
    if (leadStatus !== undefined) profileUpdate.leadStatus = leadStatus;
    if (lifecycleStage !== undefined) profileUpdate.lifecycleStage = lifecycleStage;
    if (nextActionDate !== undefined) profileUpdate.nextActionDate = nextActionDate ? new Date(nextActionDate) : null;
    if (optInSource !== undefined) profileUpdate.optInSource = optInSource;

    const updated = await db.contact.update({
      where: { id: params.id },
      data: {
        ...contactUpdate,
        ...(Object.keys(profileUpdate).length > 0 && {
          flywheelProfile: {
            update: profileUpdate
          }
        })
      },
      include: { flywheelProfile: true }
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[FlywheelLeads] PATCH Error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await db.contact.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
