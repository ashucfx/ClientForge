import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { listSalesInquiries, createSalesInquiry } from '@/lib/sales/inquiryService';
import type { InquiryStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') as InquiryStatus | null;
  const search = searchParams.get('search') ?? undefined;
  const page = parseInt(searchParams.get('page') ?? '1', 10);

  const result = await listSalesInquiries({
    status: status ?? undefined,
    search,
    page,
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const inquiry = await createSalesInquiry(body);
    return NextResponse.json({ success: true, data: inquiry });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create inquiry' }, { status: 500 });
  }
}
