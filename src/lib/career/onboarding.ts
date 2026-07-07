// src/lib/career/onboarding.ts
// Auto-onboard a CareerClient when an Invoice is marked PAID.
// Safe to call multiple times — idempotent per invoice.
// Uses a DB transaction to prevent race conditions from duplicate webhook fires.

import { prisma as db } from '@/lib/db';
import { resolveServices } from './services';
import { generateMagicToken, magicTokenExpiry } from './auth';
import { sendCareerEmail } from './email';
import { derivePackageLabel } from '@/lib/email';
import { syncCareerClientToFlywheel } from '@/lib/career/sync';
import { addWorkingDays } from '@/lib/workingDays';
import type { CareerServiceSlug } from './types';
import type { LineItem } from '@/types';
import { parseInvoiceLineItems } from '@/lib/invoiceLineItems';

const PORTAL_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'https://catalyst.theripplenexus.com');

const ADMIN_EMAIL = process.env.ADMIN_NOTIFY_EMAIL ?? 'catalyst@theripplenexus.com';

/** Map invoice line item descriptions → CareerService slugs */
function detectSlugsFromLineItems(lineItems: LineItem[]): CareerServiceSlug[] {
  const slugs = new Set<CareerServiceSlug>();

  for (const item of lineItems) {
    const d = item.description.toLowerCase();
    // Portfolio is an add-on that is NEVER part of the base Career Booster, so it
    // must be detected independently. Otherwise an upgrade line like "Premium Plus
    // (Career Booster + Portfolio)" matches "career booster" and the portfolio the
    // client just paid for is silently dropped.
    if (/portfolio/i.test(d)) slugs.add('PORTFOLIO');

    if (/full.?career|career.?booster|full.?package|premium.?plus/i.test(d)) {
      slugs.add('FULL_PACKAGE');
    } else {
      if (/linkedin/i.test(d))       slugs.add('LINKEDIN');
      if (/cover.?letter/i.test(d))  slugs.add('COVER_LETTER');
      if (/resume|cv\b/i.test(d))    slugs.add('RESUME');
    }
  }

  return slugs.size > 0 ? Array.from(slugs) : ['FULL_PACKAGE'];
}

export interface OnboardResult {
  created: boolean;
  reason: 'new' | 'repurchase' | 'already_done';
  clientId: string;
}

/**
 * Creates (or updates) a CareerClient from a paid Invoice.
 *
 * Deduplication rules (enforced inside a transaction):
 *  1. If a CareerClient already has invoiceId === invoice.id → skip.
 *  2. If a CareerClient exists with the same email → add new services, update invoiceId.
 *  3. Otherwise → create a fresh client and send the Welcome email.
 */
export async function onboardFromInvoice(invoice: {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  country: string;
  currency: string;
  totalPayable: number;
  razorpayPaymentId?: string | null;
  lineItems: unknown;
}): Promise<OnboardResult> {

  const rawItems = parseInvoiceLineItems(invoice.lineItems);
  const slugs         = detectSlugsFromLineItems(rawItems);
  const serviceRecords = await resolveServices(slugs);

  const email        = invoice.clientEmail.toLowerCase().trim();
  const magicToken   = generateMagicToken();
  const tokenExpiry  = magicTokenExpiry();
  const portalUrl    = `${PORTAL_URL}/portal/login?token=${magicToken}`;
  const packageLabel = derivePackageLabel(rawItems);

  // Use a transaction to make the check+create atomic, preventing duplicate
  // onboarding from concurrent webhook retries.
  let result: OnboardResult;
  try {
    result = await db.$transaction(async (tx) => {
    // ── 1. Already onboarded from this exact invoice? ─────────
    const byInvoice = await tx.careerClient.findFirst({
      where:  { invoiceId: invoice.id },
      select: { id: true },
    });
    if (byInvoice) {
      return { created: false, reason: 'already_done' as const, clientId: byInvoice.id };
    }

    // ── 2. Existing client by email? (re-purchase) ─────────────
    const existingClient = await tx.careerClient.findUnique({
      where:  { email },
      select: { 
        id: true, 
        name: true,
        slaDeadline: true,
        expectedDeliveryAt: true,
        services: { select: { service: { select: { slug: true } } } }
      },
    });

    if (existingClient) {
      for (const s of serviceRecords) {
        await tx.careerClientService.upsert({
          where:  { clientId_serviceId: { clientId: existingClient.id, serviceId: s.id } },
          create: { clientId: existingClient.id, serviceId: s.id },
          update: {},
        });
      }

      const existingSlugs = existingClient.services.map(s => s.service.slug);
      const newSlugs = slugs.filter(slug => !existingSlugs.includes(slug));

      let slaExtensionDays = 0;
      if (newSlugs.includes('LINKEDIN')) slaExtensionDays = Math.max(slaExtensionDays, 3);
      if (newSlugs.includes('RESUME')) slaExtensionDays = Math.max(slaExtensionDays, 5);
      if (newSlugs.includes('PORTFOLIO')) slaExtensionDays = Math.max(slaExtensionDays, 7);
      if (newSlugs.includes('FULL_PACKAGE')) slaExtensionDays = Math.max(slaExtensionDays, 7);

      const newSlaDeadline = existingClient.slaDeadline && slaExtensionDays > 0
        ? addWorkingDays(existingClient.slaDeadline, slaExtensionDays)
        : existingClient.slaDeadline;

      const newExpectedDelivery = existingClient.expectedDeliveryAt && slaExtensionDays > 0
        ? addWorkingDays(existingClient.expectedDeliveryAt, slaExtensionDays)
        : existingClient.expectedDeliveryAt;

      await tx.careerClient.update({
        where: { id: existingClient.id },
        data: {
          invoiceId:        invoice.id,
          amountPaid:       { increment: invoice.totalPayable },
          currency:         invoice.currency,
          magicToken,
          magicTokenExpiry: tokenExpiry,
          slaDeadline:      newSlaDeadline,
          expectedDeliveryAt: newExpectedDelivery,
          ...(invoice.clientPhone       ? { phone: invoice.clientPhone } : {}),
          ...(invoice.razorpayPaymentId ? { razorpayPaymentId: invoice.razorpayPaymentId } : {}),
        },
      });

      await tx.invoiceClientLink.upsert({
        where: { clientId_invoiceId: { clientId: existingClient.id, invoiceId: invoice.id } },
        create: { clientId: existingClient.id, invoiceId: invoice.id, purpose: newSlugs.length > 0 ? 'UPGRADE' : 'REPURCHASE' },
        update: {},
      });

      if (newSlugs.length > 0) {
        await tx.clientUpgradeHistory.create({
          data: {
            clientId: existingClient.id,
            invoiceId: invoice.id,
            previousServices: existingSlugs,
            addedServices: newSlugs
          }
        });
      }

      await tx.careerActivityLog.create({
        data: {
          clientId:    existingClient.id,
          action:      newSlugs.length > 0 ? 'client_upgraded' : 'client_repurchased',
          performedBy: 'system',
          metadata:    { invoiceId: invoice.id, services: slugs, newSlugs, amount: invoice.totalPayable, slaExtensionDays },
        },
      });

      return { created: false, reason: 'repurchase' as const, clientId: existingClient.id };
    }

    // ── 3. New client ──────────────────────────────────────────
    const newClient = await tx.careerClient.create({
      data: {
        name:             invoice.clientName,
        email,
        phone:            invoice.clientPhone || null,
        invoiceId:        invoice.id,
        amountPaid:       invoice.totalPayable,
        currency:         invoice.currency,
        magicToken,
        magicTokenExpiry: tokenExpiry,
        ...(invoice.razorpayPaymentId ? { razorpayPaymentId: invoice.razorpayPaymentId } : {}),
        invoiceLinks: {
          create: {
            invoiceId: invoice.id,
            purpose: 'INITIAL',
          }
        },
        services: {
          create: serviceRecords.map(s => ({ serviceId: s.id })),
        },
        activityLogs: {
          create: {
            action:      'client_created',
            performedBy: 'system',
            metadata:    { trigger: 'invoice_paid', invoiceId: invoice.id, services: slugs },
          },
        },
      },
    });

    return { created: true, reason: 'new' as const, clientId: newClient.id };
  });
  } catch (err: any) {
    // If two webhooks fire at the exact same millisecond, they both evaluate `existingClient = null`
    // The first succeeds, the second crashes with P2002 Unique Constraint on `email`.
    // We catch this gracefully, knowing the other thread succeeded.
    if (err.code === 'P2002' && err.meta?.target?.includes('email')) {
      const concurrentClient = await db.careerClient.findUnique({ where: { email } });
      if (concurrentClient) {
        return { created: false, reason: 'already_done', clientId: concurrentClient.id };
      }
    }
    throw err; // Re-throw if it's a different error
  }

  // ── Send Welcome email outside the transaction (network I/O) ──
  if (result.reason === 'new') {
    try {
      const resendId = await sendCareerEmail({
        to:      email,
        trigger: 'WELCOME',
        data:    { name: invoice.clientName, packageLabel, portalUrl },
      });
      await db.careerEmailLog.create({
        data: { clientId: result.clientId, trigger: 'WELCOME', resendId, status: 'sent' },
      });
    } catch (err) {
      console.error('[onboarding] Welcome email failed:', err);
      await db.careerEmailLog.create({
        data: {
          clientId: result.clientId,
          trigger:  'WELCOME',
          status:   'failed',
          metadata: { error: String(err) },
        },
      }).catch(() => null);

      // Alert admin so they can manually resend
      sendCareerEmail({
        to:      ADMIN_EMAIL,
        trigger: 'MESSAGE_NOTIFY',
        data: {
          recipientName: 'Catalyst Team',
          senderType:    'admin',
          portalUrl:     `${PORTAL_URL}/career/${result.clientId}`,
          body: `⚠️ Welcome email failed for new client ${invoice.clientName} (${email}). Invoice: ${invoice.id}. Please resend manually from the admin panel.`,
        },
      }).catch(console.error);
    }
  }

  // ── Sync to Flywheel CRM ──
  try {
    await syncCareerClientToFlywheel(result.clientId);
  } catch (err) {
    console.error('[onboarding] Flywheel sync failed:', err);
  }

  return result;
}
