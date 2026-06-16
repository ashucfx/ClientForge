import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { addInquiryNote } from '@/lib/sales/inquiryService';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    if (!body.note?.trim()) {
      return NextResponse.json({ error: 'note required' }, { status: 400 });
    }

    const log = await addInquiryNote(params.id, body.note.trim(), session.adminId);
    return NextResponse.json({ success: true, data: log });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to add note' }, { status: 500 });
  }
}
