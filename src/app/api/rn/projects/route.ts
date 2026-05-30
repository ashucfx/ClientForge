import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getTenantDb } from '@/lib/db/tenantDb';
import { logAudit } from '@/lib/audit/logger';

export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session || (session.role !== 'SUPER_ADMIN' && !session.brandAccess.includes('ripple_nexus'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { clientName, companyName, email, serviceModuleId, expectedDeliveryAt, budget } = body;

    if (!clientName || !email || !serviceModuleId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const tenantDb = getTenantDb('ripple_nexus');

    // Verify service module exists
    const serviceModule = await tenantDb.rnServiceModule.findUnique({
      where: { id: serviceModuleId },
    });

    if (!serviceModule) {
      return NextResponse.json({ error: 'Invalid service module' }, { status: 400 });
    }

    const firstStage = Array.isArray(serviceModule.workflowStages) && serviceModule.workflowStages.length > 0
      ? (serviceModule.workflowStages[0] as string)
      : 'NOT_STARTED';

    const newProject = await tenantDb.rnClient.create({
      data: {
        name: clientName,
        companyName: companyName || null,
        email,
        serviceModuleId,
        currentStage: firstStage,
        expectedDeliveryAt: expectedDeliveryAt ? new Date(expectedDeliveryAt) : null,
        amountPaid: budget ? parseFloat(budget) : 0,
      }
    });

    // Create an initial activity log
    await tenantDb.rnActivityLog.create({
      data: {
        clientId: newProject.id,
        action: 'provisioned the project workspace',
        performedBy: 'Admin',
      }
    });

    await logAudit(
      { tenantId: 'ripple_nexus', adminId: session.adminId, role: session.role, brandAccess: session.brandAccess },
      'PROJECT_CREATED',
      'RnClient',
      newProject.id,
      { after: newProject }
    );

    return NextResponse.json({ project: newProject });

  } catch (error: any) {
    console.error('Create Project Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
