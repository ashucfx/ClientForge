import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';

export async function POST(req: NextRequest) {
  try {
    const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
    const payload = await verifyPortalToken(token);
    
    // We can allow anonymous bug reports or strictly require auth
    // Let's require auth for portal clients
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await db.careerClient.findUnique({
      where: { id: payload.clientId },
      select: { id: true, name: true, email: true },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const body = await req.json();
    const { description, url } = body;

    if (!description) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }

    const bugReport = await db.bugReport.create({
      data: {
        clientId: client.id,
        clientName: client.name,
        clientEmail: client.email,
        description,
        url: url || undefined,
        status: 'OPEN',
      },
    });

    return NextResponse.json({ success: true, id: bugReport.id });
  } catch (error: any) {
    console.error('Bug report error:', error);
    return NextResponse.json({ error: 'Failed to submit bug report' }, { status: 500 });
  }
}
