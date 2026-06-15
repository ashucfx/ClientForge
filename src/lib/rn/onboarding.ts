import { prisma } from '@/lib/db';
import type { Invoice } from '@prisma/client';
import { randomBytes } from 'crypto';

/**
 * Onboards a Ripple Nexus client after successful payment.
 * This function handles the "Agency" flow, keeping it completely separated from the Catalyst "Career" flow.
 */
export async function rnOnboardFromInvoice(invoice: Invoice) {
  console.log(`[rn-onboard] Starting RN onboarding for Invoice ${invoice.id} (${invoice.clientEmail})`);

  // 1. Check if RN client already exists
  let client = await prisma.rnClient.findFirst({
    where: { email: invoice.clientEmail },
  });

  if (client) {
    // 3. Update existing client if needed (e.g., refresh token if expired or just link invoice)
    if (client.invoiceId === invoice.id) {
      console.log(`[rn-onboard] Invoice already linked for ${client.email}, skipping.`);
      return;
    }
    console.log(`[rn-onboard] Found existing RN Client: ${client.id}`);
  }

  // Handle potentially missing rnServiceId which would cause Prisma FK crash
  let serviceId = invoice.rnServiceId;
  if (!serviceId) {
    const defaultModule = await prisma.rnServiceModule.findFirst();
    if (defaultModule) {
      serviceId = defaultModule.id;
    } else {
      console.warn(`[rn-onboard] No RnServiceModule exists in DB. RN Onboarding might fail.`);
    }
  }

  if (!client) {
    // Create new RN Client with a magic link token
    const portalToken = randomBytes(32).toString('hex');
    
    client = await prisma.rnClient.create({
      data: {
        name: invoice.clientName,
        email: invoice.clientEmail,
        phone: invoice.clientPhone || '',
        companyName: invoice.companyName || '',
        serviceModuleId: serviceId || '',
        magicToken: portalToken,
      },
    });
    console.log(`[rn-onboard] Created new RN Client: ${client.id}`);
  }

  // 4. Update the RN Client to link the Invoice and payment details
  await prisma.rnClient.update({
    where: { id: client.id },
    data: { 
      invoiceId: invoice.id,
      amountPaid: { increment: invoice.totalPayable },
      currency: invoice.currency 
    },
  });

  // 5. Send RN Welcome / Portal Email
  // The RN portal url would be: /rn/portal/[token]
  const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://catalyst.theripplenexus.com'}/rn/portal/${client.magicToken}`;
  
  const { sendRnOnboardingEmail } = await import('./email');
  await sendRnOnboardingEmail(client.email, client.name, portalUrl);
  console.log(`[rn-onboard] RN Onboarding complete for ${client.email}. Portal URL: ${portalUrl}`);
}
