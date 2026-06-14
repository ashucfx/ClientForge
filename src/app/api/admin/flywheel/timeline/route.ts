import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getUnifiedTimeline } from '@/lib/flywheel/timeline';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const contactId = searchParams.get('contactId');

    if (!contactId) {
      return NextResponse.json({ success: false, error: 'contactId is required' }, { status: 400 });
    }

    const events = await getUnifiedTimeline(contactId);

    return NextResponse.json({ success: true, data: events });
  } catch (error) {
    console.error('[TimelineAPI] GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
