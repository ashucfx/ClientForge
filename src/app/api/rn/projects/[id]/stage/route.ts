import { NextResponse } from 'next/server';
import { requireRnAdmin } from '@/lib/auth/rnAdmin';
import { getTenantDb } from '@/lib/db/tenantDb';
import { logAudit } from '@/lib/audit/logger';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireRnAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { newStage } = await req.json();
    if (!newStage) {
      return NextResponse.json({ error: 'Missing new stage' }, { status: 400 });
    }

    const tenantDb = getTenantDb('ripple_nexus');

    const client = await tenantDb.rnClient.findUnique({
      where: { id: params.id }
    });

    if (!client) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const completedArr = Array.isArray(client.completedStages) ? [...client.completedStages] : [];
    if (!completedArr.includes(client.currentStage)) {
      completedArr.push(client.currentStage);
    }

    const updated = await tenantDb.rnClient.update({
      where: { id: params.id },
      data: {
        currentStage: newStage,
        completedStages: completedArr,
        stageEnteredAt: new Date(),
      }
    });

    await tenantDb.rnActivityLog.create({
      data: {
        clientId: params.id,
        action: `moved milestone to ${newStage.replace(/_/g, ' ')}`,
        performedBy: 'Admin'
      }
    });

    await logAudit(
      { tenantId: 'ripple_nexus', adminId: session.adminId, role: session.role, brandAccess: session.brandAccess },
      'PROJECT_STAGE_UPDATED',
      'RnClient',
      params.id,
      { before: { currentStage: client.currentStage }, after: { currentStage: newStage } }
    );

    return NextResponse.json({ success: true, project: updated });

  } catch (error: any) {
    console.error('Update Project Stage Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
