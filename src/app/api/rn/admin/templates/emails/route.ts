import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const templates = await prisma.rnEmailTemplate.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ data: templates });
  } catch (error) {
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

    const { triggerEvent, subject, htmlBody, availableVariables } = await req.json();

    const template = await prisma.rnEmailTemplate.upsert({
      where: { triggerEvent },
      update: { subject, htmlBody, availableVariables },
      create: { triggerEvent, subject, htmlBody, availableVariables }
    });

    return NextResponse.json({ data: template }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
