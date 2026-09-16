import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const contacts = await prisma.contact.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        careerClients: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            amountPaid: true,
            currency: true,
            createdAt: true,
          },
        },
        salesInquiries: {
          select: {
            id: true,
            displayId: true,
            status: true,
          },
        },
      },
    });
    return NextResponse.json(contacts);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
