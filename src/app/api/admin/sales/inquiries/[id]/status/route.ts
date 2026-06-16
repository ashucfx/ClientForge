import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { transitionInquiryStatus } from '@/lib/sales/inquiryService';
import type { InquiryStatus } from '@prisma/client';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const toStatus = body.status as InquiryStatus;
    if (!toStatus) {
      return NextResponse.json({ error: 'status required' }, { status: 400 });
    }

    const updated = await transitionInquiryStatus(params.id, toStatus, {
      adminId: session.adminId,
      note: body.note,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transition failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
