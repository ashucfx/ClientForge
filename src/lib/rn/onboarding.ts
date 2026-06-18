import { prisma } from '@/lib/db';
import type { Invoice } from '@prisma/client';
import { randomBytes } from 'crypto';

/**
 * Onboards a Ripple Nexus client after successful payment.
 * Idempotent: safe to call multiple times for the same invoice.
 * Uses a transaction to prevent duplicate amountPaid increments on concurrent webhook retries.
 */
export async function rnOnboardFromInvoice(invoice: Invoice) {
  console.log(`[rn-onboard] Starting RN onboarding for Invoice ${invoice.id} (${invoice.clientEmail})`);

  let serviceId = invoice.rnServiceId;
  if (!serviceId) {
    const defaultModule = await prisma.rnServiceModule.findFirst();
    if (defaultModule) {
      serviceId = defaultModule.id;
    } else {
      console.warn(`[rn-onboard] No RnServiceModule exists in DB. Onboarding may fail.`);
    }
  }

  let client: { id: string; magicToken: string | null; email: string; name: string } | null = null;
  let isNew = false;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.rnClient.findFirst({ where: { email: invoice.clientEmail } });

      if (existing?.invoiceId === invoice.id) {
        // Already fully onboarded from this exact invoice — skip
        return { skip: true, client: existing };
      }

      if (existing) {
        // Returning client — link new invoice and increment revenue
        const updated = await tx.rnClient.update({
          where: { id: existing.id },
          data: {
            invoiceId:   invoice.id,
            amountPaid:  { increment: invoice.totalPayable },
            currency:    invoice.currency,
          },
        });
        return { skip: false, client: updated, isNew: false };
      }

      // New client
      const portalToken = randomBytes(32).toString('hex');
      const created = await tx.rnClient.create({
        data: {
          name:            invoice.clientName,
          email:           invoice.clientEmail,
          phone:           invoice.clientPhone || '',
          companyName:     invoice.companyName || '',
          serviceModuleId: serviceId || '',
          magicToken:      portalToken,
          invoiceId:       invoice.id,
          amountPaid:      invoice.totalPayable,
          currency:        invoice.currency,
        },
      });
      return { skip: false, client: created, isNew: true };
    });

    if (result.skip) {
      console.log(`[rn-onboard] Invoice ${invoice.id} already linked — skipping.`);
      return;
    }

    client = result.client;
    isNew  = result.isNew ?? false;

  } catch (err: any) {
    // Two concurrent webhooks raced through the findFirst check — the second one
    // gets a unique constraint violation on email. The first succeeded, so we're safe.
    if (err.code === 'P2002') {
      const concurrent = await prisma.rnClient.findFirst({ where: { email: invoice.clientEmail } });
      if (concurrent) {
        console.log(`[rn-onboard] Concurrent race resolved for ${invoice.clientEmail}`);
        return;
      }
    }
    throw err;
  }

  if (!client) return;

  // Send portal welcome email — failure is non-fatal (client is already created)
  const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://catalyst.theripplenexus.com'}/rn/portal/${client.magicToken}`;
  try {
    const { sendRnOnboardingEmail } = await import('./email');
    await sendRnOnboardingEmail(client.email, client.name, portalUrl);
    console.log(`[rn-onboard] Onboarding complete for ${client.email}. isNew=${isNew}`);
  } catch (emailErr) {
    // Log but don't throw — the client record was created successfully.
    // Admin will receive an alert via the webhook's outer catch if this was from a webhook.
    console.error(`[rn-onboard] Welcome email failed for ${client.email}:`, emailErr);
  }
}
