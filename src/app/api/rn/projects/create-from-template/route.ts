import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { sendRnEmail, tplWelcome, portalUrlFor } from '@/lib/rn/mailer';

function generatePassword(length: number = 12) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';
  let retVal = '';
  for (let i = 0, n = charset.length; i < length; ++i) {
    retVal += charset.charAt(Math.floor(Math.random() * n));
  }
  return retVal;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (admin.role !== 'SUPER_ADMIN' && admin.role !== 'PROJECT_MANAGER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { serviceTemplateId, clientEmail, clientName, companyName, clientPhone, invoiceDueDate, expectedDeliveryAt } = body;

    if (!serviceTemplateId || !clientEmail || !clientName || !clientPhone) {
      return NextResponse.json({ error: 'Missing required fields. Client Name, Email, and Phone Number are compulsory.' }, { status: 400 });
    }

    const template = await prisma.rnServiceTemplate.findUnique({
      where: { id: serviceTemplateId },
      include: {
        milestoneTemplates: {
          orderBy: { order: 'asc' },
          include: { taskTemplates: true }
        },
        deliverableTemplates: true,
        onboardingTemplates: true,
      }
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // 1. Generate Auth Token and Password
    const magicToken = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    const rawPassword = generatePassword(12);

    // Dynamic resolution of crypto logic due to environment quirks
    let passwordHash = rawPassword;
    try {
      const crypto = require('crypto');
      passwordHash = crypto.scryptSync(rawPassword, 'salt', 64).toString('hex');
    } catch(e) {
      // Fallback
    }

    // Begin massive instantiation transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create Client
      const client = await tx.rnClient.create({
        data: {
          email: clientEmail,
          magicToken,
          name: clientName,
          companyName,
          phone: clientPhone,
          serviceModuleId: 'dummy_for_now', // We will update this or use the template id as reference
          currentStage: 'ONBOARDING',
          expectedDeliveryAt: expectedDeliveryAt ? new Date(expectedDeliveryAt) : null,
        }
      });

      // Create ServiceModule specific to this client if required, but currently schema requires serviceModuleId referencing RnServiceModule.
      // Wait, RnClient requires serviceModuleId. The existing logic relies on RnServiceModule.
      // We should probably map the RnServiceTemplate to a generic RnServiceModule or create one on the fly.
      let serviceModule = await tx.rnServiceModule.findFirst({ where: { name: template.name } });
      if (!serviceModule) {
        serviceModule = await tx.rnServiceModule.create({
          data: {
            slug: template.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            name: template.name,
            workflowStages: ['ONBOARDING', 'REQUIREMENTS', 'DEVELOPMENT', 'TESTING', 'DELIVERY'],
            isActive: true
          }
        });
      }
      
      await tx.rnClient.update({
        where: { id: client.id },
        data: { serviceModuleId: serviceModule.id }
      });

      // Create Milestones and Tasks
      let milestoneDateCursor = new Date();
      for (const mTemplate of template.milestoneTemplates) {
        milestoneDateCursor = new Date(milestoneDateCursor.getTime() + mTemplate.estimatedDurationDays * 24 * 60 * 60 * 1000);
        
        const milestone = await tx.rnProjectMilestone.create({
          data: {
            clientId: client.id,
            title: mTemplate.title,
            description: mTemplate.description,
            order: mTemplate.order,
            dueDate: milestoneDateCursor,
            // Calculate amount based on pricingModel and percentage if known, for now 0
            amount: 0, 
            currency: template.baseCurrency,
          }
        });

        for (const tTemplate of mTemplate.taskTemplates) {
          await tx.rnProjectTask.create({
            data: {
              milestoneId: milestone.id,
              title: tTemplate.title,
            }
          });
        }
      }

      // Create Deliverables placeholders
      for (const dTemplate of template.deliverableTemplates) {
        await tx.rnDeliverable.create({
          data: {
            clientId: client.id,
            label: dTemplate.label,
            fileUrl: '', // To be filled later
            uploadedBy: admin.adminId,
            approvalStatus: 'PENDING',
            publicId: 'N/A',
            fileType: 'document',
            mimeType: 'application/pdf',
          }
        });
      }

      // Create Invoice
      // (Optional logic to generate an invoice based on template)
      
      return client;
    });

    // Send Onboarding/Welcome Email
    // If we have an email template for "WELCOME", we would render variables and send.
    // Fallback to basic standard welcome:
    const { subject, html } = tplWelcome(clientName, portalUrlFor ? portalUrlFor(magicToken) : `${process.env.NEXT_PUBLIC_APP_URL}/rn/portal/${magicToken}`);
    await sendRnEmail({
      clientId: result.id,
      to: clientEmail,
      subject,
      html,
      trigger: 'welcome',
      sentBy: admin.adminId,
    }).catch(console.error);

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error('Failed to instantiate template:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
