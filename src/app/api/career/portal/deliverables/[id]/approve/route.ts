
import { NextResponse as Response } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
    const session = await verifyPortalToken(token);
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const file = await prisma.careerDeliverable.findUnique({
      where: { id: params.id, clientId: session.clientId },
    });

    if (!file) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    if (file.fileCategory !== 'final') {
      return Response.json({ error: 'Can only approve final deliverables' }, { status: 400 });
    }

    const updated = await prisma.careerDeliverable.update({
      where: { id: params.id },
      data: {
        approvalStatus: 'APPROVED',
        approvedAt: new Date(),
      },
    });

    // Log the approval activity
    await prisma.careerActivityLog.create({
      data: {
        clientId: session.clientId,
        action: 'deliverable_approved',
        performedBy: 'client',
        metadata: { fileId: file.id, fileLabel: file.label },
      },
    });

    return Response.json({ success: true, deliverable: updated });
  } catch (error) {
    console.error('Approve deliverable error:', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
