import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { requireRnAdmin } from '@/lib/auth/rnAdmin';
import { getTenantDb } from '@/lib/db/tenantDb';
import { logAudit } from '@/lib/audit/logger';

export async function POST(req: Request) {
  try {
    const session = await requireRnAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { clientName, companyName, email, phone, serviceModuleId, expectedDeliveryAt, budget } = body;

    if (!clientName || !email || !phone || !serviceModuleId) {
      return NextResponse.json({ error: 'Missing required fields. Name, Email, Phone and Service Module are compulsory.' }, { status: 400 });
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
        phone,
        serviceModuleId,
        currentStage: firstStage,
        expectedDeliveryAt: expectedDeliveryAt ? new Date(expectedDeliveryAt) : null,
        amountPaid: budget ? parseFloat(budget) : 0,
        // Every project gets a portal link from day one — admin-created
        // projects previously had none, which 404'd the client portal.
        magicToken: randomBytes(32).toString('hex'),
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

    // Onboarding flow: send the branded portal invite immediately so the
    // client can log in the moment the project exists (opt-out via sendInvite:false).
    if (body.sendInvite !== false) {
      try {
        const { sendRnEmail, tplWelcome, portalUrlFor } = await import('@/lib/rn/mailer');
        const { subject, html } = tplWelcome(newProject.name, portalUrlFor(newProject.magicToken));
        await sendRnEmail({
          clientId: newProject.id,
          to: newProject.email,
          subject,
          html,
          trigger: 'welcome',
          sentBy: session.adminId,
        });
      } catch (e) {
        console.error('[rn projects] welcome email failed:', e);
      }
    }

    return NextResponse.json({ project: newProject });

  } catch (error: any) {
    console.error('Create Project Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
