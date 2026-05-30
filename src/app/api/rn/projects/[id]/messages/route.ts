import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getTenantDb } from '@/lib/db/tenantDb';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAdminSession();
    if (!session || (session.role !== 'SUPER_ADMIN' && !session.brandAccess.includes('ripple_nexus'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { content } = await req.json();
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Invalid message content' }, { status: 400 });
    }

    const tenantDb = getTenantDb('ripple_nexus');

    const message = await tenantDb.rnMessage.create({
      data: {
        clientId: params.id,
        content,
        authorType: 'admin',
        authorName: 'Admin',
        readByAdmin: true,
      }
    });

    return NextResponse.json({ success: true, message });

  } catch (error: any) {
    console.error('Send Message Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
