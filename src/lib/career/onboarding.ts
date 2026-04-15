// src/lib/career/onboarding.ts
// Auto-onboard a CareerClient when an Invoice is marked PAID.
// Safe to call multiple times — idempotent per invoice.

import { prisma as db } from '@/lib/db';
import { resolveServices } from './services';
import { generateMagicToken, magicTokenExpiry } from './auth';
import { sendCareerEmail } from './email';
import { derivePackageLabel } from '@/lib/email';
import type { CareerServiceSlug } from './types';
import type { LineItem } from '@/types';

const PORTAL_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');

/** Map invoice line item descriptions → CareerService slugs */
function detectSlugsFromLineItems(lineItems: LineItem[]): CareerServiceSlug[] {
  const slugs = new Set<CareerServiceSlug>();

  for (const item of lineItems) {
    const d = item.description.toLowerCase();
    if (/full.?career|career.?booster|full.?package/i.test(d)) {
      slugs.add('FULL_PACKAGE');
    } else {
      if (/linkedin/i.test(d))                   slugs.add('LINKEDIN');
      if (/cover.?letter/i.test(d))               slugs.add('COVER_LETTER');
      if (/resume|cv\b/i.test(d))                 slugs.add('RESUME');
      if (/portfolio/i.test(d))                   slugs.add('PORTFOLIO');
    }
  }

  // Fallback — if nothing matched, treat as full package
  return slugs.size > 0 ? Array.from(slugs) : ['FULL_PACKAGE'];
}

export interface OnboardResult {
  /** true = new client created; false = existing client updated or already done */
  created: boolean;
  /** 'new' | 'repurchase' | 'already_done' */
  reason: 'new' | 'repurchase' | 'already_done';
  clientId: string;
}

/**
 * Creates (or updates) a CareerClient from a paid Invoice.
 *
 * Deduplication rules:
 *  1. If a CareerClient already has invoiceId === invoice.id → skip (already onboarded).
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
  lineItems: unknown; // Json from Prisma — we cast internally
}): Promise<OnboardResult> {
  // ── 1. Already onboarded from this exact invoice? ─────────────
  const byInvoice = await db.careerClient.findFirst({
    where: { invoiceId: invoice.id },
    select: { id: true },
  });
  if (byInvoice) {
    return { created: false, reason: 'already_done', clientId: byInvoice.id };
  }

  // ── 2. Detect services ────────────────────────────────────────
  const rawItems: LineItem[] = Array.isArray(invoice.lineItems)
    ? (invoice.lineItems as LineItem[])
    : [];
  const slugs = detectSlugsFromLineItems(rawItems);
  const serviceRecords = await resolveServices(slugs);

  const email        = invoice.clientEmail.toLowerCase().trim();
  const magicToken   = generateMagicToken();
  const tokenExpiry  = magicTokenExpiry();
  const portalUrl    = `${PORTAL_URL}/portal/login?token=${magicToken}`;
  // Derive package label from actual line items (same logic as invoice email)
  const packageLabel = derivePackageLabel(rawItems);

  // ── 3. Existing client by email? (re-purchase) ────────────────
  const existingClient = await db.careerClient.findUnique({
    where: { email },
    select: { id: true, name: true },
  });

  if (existingClient) {
    // Upsert any new service mappings
    for (const s of serviceRecords) {
      await db.careerClientService.upsert({
        where: { clientId_serviceId: { clientId: existingClient.id, serviceId: s.id } },
        create: { clientId: existingClient.id, serviceId: s.id },
        update: {},
      });
    }

    await db.careerClient.update({
      where:  { id: existingClient.id },
      data: {
        invoiceId:         invoice.id,
        amountPaid:        invoice.totalPayable,
        currency:          invoice.currency,
        magicToken,
        magicTokenExpiry:  tokenExpiry,
        ...(invoice.clientPhone ? { phone: invoice.clientPhone } : {}),
        ...(invoice.razorpayPaymentId ? { razorpayPaymentId: invoice.razorpayPaymentId } : {}),
      },
    });

    await db.careerActivityLog.create({
      data: {
        clientId:    existingClient.id,
        action:      'client_repurchased',
        performedBy: 'system',
        metadata:    { invoiceId: invoice.id, services: slugs, amount: invoice.totalPayable },
      },
    });

    return { created: false, reason: 'repurchase', clientId: existingClient.id };
  }

  // ── 4. New client ─────────────────────────────────────────────
  const newClient = await db.careerClient.create({
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

  // ── 5. Send Welcome email ─────────────────────────────────────
  try {
    const resendId = await sendCareerEmail({
      to:      email,
      trigger: 'WELCOME',
      data:    { name: newClient.name, packageLabel, portalUrl },
    });
    await db.careerEmailLog.create({
      data: { clientId: newClient.id, trigger: 'WELCOME', resendId, status: 'sent' },
    });
  } catch (err) {
    console.error('[onboarding] Welcome email failed:', err);
  }

  return { created: true, reason: 'new', clientId: newClient.id };
}
