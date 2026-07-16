import { NextResponse } from 'next/server';
import { requireRnAdmin } from '@/lib/auth/rnAdmin';
import { getTenantDb } from '@/lib/db/tenantDb';
import { logAudit } from '@/lib/audit/logger';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireRnAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { label, fileUrl, publicId, fileType, mimeType, sizeBytes, fileCategory, stageContext } = await req.json();

    if (!label || !fileUrl || !publicId) {
      return NextResponse.json({ error: 'Missing required file data' }, { status: 400 });
    }

    const tenantDb = getTenantDb('ripple_nexus');

    const deliverable = await tenantDb.rnDeliverable.create({
      data: {
        clientId: params.id,
        label,
        originalName: label,
        fileUrl,
        publicId,
        fileType: fileType || 'auto',
        mimeType: mimeType || 'application/octet-stream',
        sizeBytes: sizeBytes || 0,
        fileCategory: fileCategory || 'final',
        stageContext: stageContext || null,
        uploadedBy: session.adminId
      }
    });

    await tenantDb.rnActivityLog.create({
      data: {
        clientId: params.id,
        action: `uploaded a new deliverable: ${label}`,
        performedBy: 'Admin'
      }
    });

    // Automatic flow: deliverable-ready email over SMTP
    try {
      const { sendRnEmail, tplDeliverableUploaded, portalUrlFor } = await import('@/lib/rn/mailer');
      const full = await tenantDb.rnClient.findUnique({ where: { id: params.id } });
      if (full) {
        const { subject, html } = tplDeliverableUploaded(full.name, label, portalUrlFor(full.magicToken));
        await sendRnEmail({
          clientId: full.id, to: full.email, subject, html,
          trigger: 'deliverable_uploaded', sentBy: session.adminId,
          metadata: { deliverableId: deliverable.id },
        });
      }
    } catch (e) {
      console.error('[rn deliverables] email flow failed:', e);
    }

    await logAudit(
      { tenantId: 'ripple_nexus', adminId: session.adminId, role: session.role, brandAccess: session.brandAccess },
      'DELIVERABLE_UPLOADED',
      'RnDeliverable',
      deliverable.id,
      { after: deliverable }
    );

    return NextResponse.json({ success: true, deliverable });

  } catch (error: any) {
    console.error('Upload Deliverable Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
