import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getTenantDb } from '@/lib/db/tenantDb';
import { logAudit } from '@/lib/audit/logger';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAdminSession();
    if (!session || (session.role !== 'SUPER_ADMIN' && !session.brandAccess.includes('ripple_nexus'))) {
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
