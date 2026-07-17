// src/app/api/rn/milestones/[id]/route.ts
// PATCH  — edit fields, change status, reorder, and run payment operations
//          (request payment → SMTP email; mark paid → revenue rollup)
// DELETE — remove a milestone

import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { requireRnAdmin } from '@/lib/auth/rnAdmin';
import { createRazorpayPaymentLink } from '@/lib/razorpay';
import type { InvoiceData } from '@/types';

export const runtime = 'nodejs';

const STATUSES = new Set(['PENDING', 'IN_PROGRESS', 'IN_REVIEW', 'APPROVED', 'COMPLETED']);
const CURRENCY_SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$' };
const money = (amt: number, cur: string) => `${CURRENCY_SYMBOLS[cur] ?? `${cur} `}${Math.round(amt).toLocaleString()}`;

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await requireRnAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const milestone = await db.rnProjectMilestone.findUnique({
    where: { id: params.id },
    include: { client: { select: { id: true, name: true, email: true, magicToken: true, currency: true } } },
  });
  if (!milestone) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });

  /* ── Reorder ── */
  if (body.move === 'up' || body.move === 'down') {
    const siblings = await db.rnProjectMilestone.findMany({
      where: { clientId: milestone.clientId },
      orderBy: { order: 'asc' },
      select: { id: true, order: true },
    });
    const idx = siblings.findIndex(s => s.id === milestone.id);
    const swapWith = body.move === 'up' ? siblings[idx - 1] : siblings[idx + 1];
    if (swapWith) {
      await db.$transaction([
        db.rnProjectMilestone.update({ where: { id: milestone.id }, data: { order: swapWith.order } }),
        db.rnProjectMilestone.update({ where: { id: swapWith.id }, data: { order: siblings[idx].order } }),
      ]);
    }
    return NextResponse.json({ ok: true });
  }

  /* ── Payment operations ── */
  if (body.paymentAction === 'request') {
    if (milestone.amount <= 0) return NextResponse.json({ error: 'Milestone has no payment amount' }, { status: 400 });
    
    let finalInvoiceId = typeof body.invoiceId === 'string' ? body.invoiceId : milestone.invoiceId;
    
    // Razorpay Integration
    const isRazorpayRequested = body.gateway === 'razorpay' || true; // Default to Razorpay for RN
    if (isRazorpayRequested) {
      try {
        const invoicePayload = {
          id: milestone.id,
          invoiceNumber: `RN-MS-${milestone.id.slice(-6).toUpperCase()}`,
          clientName: milestone.client.name,
          clientEmail: milestone.client.email,
          clientPhone: '0000000000', // Fallback, would ideally be on client
          clientType: 'B2B' as any,
          country: 'IN', // Default
          currency: milestone.currency,
          totalPayable: milestone.amount,
          brandId: 'ripple_nexus',
          dueDate: milestone.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now if null
        } as unknown as InvoiceData;

        const rzp = await createRazorpayPaymentLink(invoicePayload);
        finalInvoiceId = rzp.short_url;
      } catch (err: any) {
        return NextResponse.json({ error: `Razorpay Error: ${err.message}` }, { status: 500 });
      }
    }

    const updated = await db.rnProjectMilestone.update({
      where: { id: milestone.id },
      data: { paymentStatus: 'REQUESTED', invoiceId: finalInvoiceId },
    });

    // Automatic flow: payment-request email over SMTP (manual sends can skip via sendEmail:false)
    if (body.sendEmail !== false) {
      const { sendRnEmail, tplMilestonePaymentRequest, portalUrlFor } = await import('@/lib/rn/mailer');
      let invoiceUrl: string | undefined;
      if (updated.invoiceId?.includes('rzp.io')) {
        invoiceUrl = updated.invoiceId;
      } else if (updated.invoiceId) {
        invoiceUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://clientforge.theripplenexus.com'}/rn/invoices/${updated.invoiceId}`;
      }
      const { subject, html } = tplMilestonePaymentRequest(
        milestone.client.name, milestone.title, money(milestone.amount, milestone.currency),
        portalUrlFor(milestone.client.magicToken), invoiceUrl,
      );
      await sendRnEmail({
        clientId: milestone.clientId, to: milestone.client.email, subject, html,
        trigger: 'milestone_payment_request', sentBy: session.adminId,
        metadata: { milestoneId: milestone.id, amount: milestone.amount, currency: milestone.currency },
      });
    }

    await db.rnActivityLog.create({
      data: { clientId: milestone.clientId, action: `requested payment for "${milestone.title}" (${money(milestone.amount, milestone.currency)})`, performedBy: 'Admin' },
    }).catch(() => {});
    return NextResponse.json({ milestone: updated });
  }

  if (body.paymentAction === 'markPaid') {
    if (milestone.paymentStatus === 'PAID') return NextResponse.json({ error: 'Already paid' }, { status: 400 });
    if (milestone.amount <= 0) return NextResponse.json({ error: 'Milestone has no payment amount' }, { status: 400 });

    // Revenue rollup: milestone payments feed the client's lifetime value.
    const [updated] = await db.$transaction([
      db.rnProjectMilestone.update({
        where: { id: milestone.id },
        data: { paymentStatus: 'PAID', paidAt: new Date() },
      }),
      db.rnClient.update({
        where: { id: milestone.clientId },
        data: { amountPaid: { increment: milestone.amount } },
      }),
    ]);

    await db.rnActivityLog.create({
      data: { clientId: milestone.clientId, action: `received milestone payment ${money(milestone.amount, milestone.currency)} for "${milestone.title}"`, performedBy: 'Admin' },
    }).catch(() => {});
    return NextResponse.json({ milestone: updated });
  }

  if (body.paymentAction === 'markUnpaid') {
    const wasPaid = milestone.paymentStatus === 'PAID';
    const [updated] = await db.$transaction([
      db.rnProjectMilestone.update({
        where: { id: milestone.id },
        data: { paymentStatus: milestone.amount > 0 ? 'UNPAID' : 'NOT_APPLICABLE', paidAt: null },
      }),
      ...(wasPaid
        ? [db.rnClient.update({ where: { id: milestone.clientId }, data: { amountPaid: { decrement: milestone.amount } } })]
        : []),
    ]);
    return NextResponse.json({ milestone: updated });
  }

  /* ── Field edits / status ── */
  const data: Record<string, any> = {};
  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim().slice(0, 200);
  if (typeof body.description === 'string') data.description = body.description.slice(0, 2000) || null;
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (body.amount !== undefined) {
    const amount = Math.max(0, Number(body.amount) || 0);
    data.amount = amount;
    if (milestone.paymentStatus !== 'PAID') {
      data.paymentStatus = amount > 0 ? (milestone.paymentStatus === 'REQUESTED' ? 'REQUESTED' : 'UNPAID') : 'NOT_APPLICABLE';
    }
  }
  if (typeof body.currency === 'string' && body.currency) data.currency = body.currency.slice(0, 5);
  if (typeof body.status === 'string' && STATUSES.has(body.status)) {
    data.status = body.status;
    if (body.status === 'COMPLETED' || body.status === 'APPROVED') data.completedAt = new Date();
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const updated = await db.rnProjectMilestone.update({ where: { id: milestone.id }, data });

  // Automatic flow: completion email
  if ((data.status === 'COMPLETED' || data.status === 'APPROVED') && body.sendEmail !== false) {
    const { sendRnEmail, tplMilestoneCompleted, portalUrlFor } = await import('@/lib/rn/mailer');
    const { subject, html } = tplMilestoneCompleted(milestone.client.name, updated.title, portalUrlFor(milestone.client.magicToken));
    await sendRnEmail({
      clientId: milestone.clientId, to: milestone.client.email, subject, html,
      trigger: 'milestone_completed', sentBy: session.adminId,
      metadata: { milestoneId: milestone.id },
    });
  }

  return NextResponse.json({ milestone: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireRnAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const milestone = await db.rnProjectMilestone.findUnique({ where: { id: params.id } });
  if (!milestone) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (milestone.paymentStatus === 'PAID') {
    return NextResponse.json({ error: 'Cannot delete a paid milestone — mark it unpaid first' }, { status: 400 });
  }

  await db.rnProjectMilestone.delete({ where: { id: params.id } });
  await db.rnActivityLog.create({
    data: { clientId: milestone.clientId, action: `removed milestone "${milestone.title}"`, performedBy: 'Admin' },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
