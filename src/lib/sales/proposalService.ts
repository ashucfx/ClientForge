import type { Prisma } from '@prisma/client';
import type { ClientType } from '@prisma/client';
import { prisma as db } from '@/lib/db';
import type { ProposalStatus } from '@prisma/client';
import { transitionInquiryStatusTx } from './inquiryService';
import type { LineItem } from '@/types';

export interface CreateProposalInput {
  inquiryId: string;
  title: string;
  scopeSummary: string;
  deliverables: string[];
  lineItems: LineItem[];
  currency: string;
  currencySymbol: string;
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  validUntil: Date;
  adminId?: string;
}

export async function createProposal(input: CreateProposalInput) {
  return db.$transaction(async (tx) => {
    const inquiry = await tx.salesInquiry.findUniqueOrThrow({
      where: { id: input.inquiryId },
    });

    const latest = await tx.proposal.findFirst({
      where: { inquiryId: input.inquiryId },
      orderBy: { version: 'desc' },
    });
    const version = (latest?.version ?? 0) + 1;

    const proposal = await tx.proposal.create({
      data: {
        inquiryId: input.inquiryId,
        version,
        status: 'DRAFT',
        title: input.title,
        scopeSummary: input.scopeSummary,
        deliverables: input.deliverables,
        lineItems: input.lineItems as unknown as Prisma.InputJsonValue,
        currency: input.currency,
        currencySymbol: input.currencySymbol,
        subtotal: input.subtotal,
        discount: input.discount ?? 0,
        tax: input.tax ?? 0,
        total: input.total,
        validUntil: input.validUntil,
      },
    });

    await tx.inquiryActivityLog.create({
      data: {
        inquiryId: input.inquiryId,
        action: 'PROPOSAL_CREATED',
        adminId: input.adminId,
        note: `Proposal v${version} created`,
        metadata: { proposalId: proposal.id },
      },
    });

    return proposal;
  });
}

export async function sendProposal(proposalId: string, adminId?: string) {
  return db.$transaction(async (tx) => {
    const proposal = await tx.proposal.findUniqueOrThrow({
      where: { id: proposalId },
      include: { inquiry: true },
    });

    if (proposal.status !== 'DRAFT') {
      throw new Error('Only draft proposals can be sent');
    }

    const updated = await tx.proposal.update({
      where: { id: proposalId },
      data: { status: 'SENT', sentAt: new Date() },
    });

    if (proposal.inquiry.status === 'QUALIFIED') {
      await transitionInquiryStatusTx(tx, proposal.inquiryId, 'PROPOSAL_SENT', {
        adminId,
        note: `Proposal v${proposal.version} sent`,
        metadata: { proposalId },
      });
    }

    return updated;
  });
}

export async function getProposalByToken(publicToken: string) {
  const proposal = await db.proposal.findUnique({
    where: { publicToken },
    include: { inquiry: true },
  });

  if (!proposal) return null;

  if (proposal.status === 'SENT' && !proposal.viewedAt) {
    await db.proposal.update({
      where: { id: proposal.id },
      data: { status: 'VIEWED', viewedAt: new Date() },
    });
  }

  return proposal;
}

export async function acceptProposal(publicToken: string, acceptedByEmail: string) {
  return db.$transaction(async (tx) => {
    const proposal = await tx.proposal.findUniqueOrThrow({
      where: { publicToken },
      include: { inquiry: true },
    });

    if (!['SENT', 'VIEWED'].includes(proposal.status)) {
      throw new Error('Proposal cannot be accepted in current state');
    }

    if (new Date() > proposal.validUntil) {
      await tx.proposal.update({
        where: { id: proposal.id },
        data: { status: 'EXPIRED' },
      });
      throw new Error('Proposal has expired');
    }

    const normalizedEmail = acceptedByEmail.toLowerCase().trim();
    if (normalizedEmail !== proposal.inquiry.email.toLowerCase().trim()) {
      throw new Error('Acceptance email must match the proposal recipient email');
    }

    const updated = await tx.proposal.update({
      where: { id: proposal.id },
      data: {
        status: 'ACCEPTED',
        respondedAt: new Date(),
        acceptedByEmail: normalizedEmail,
      },
    });

    await transitionInquiryStatusTx(tx, proposal.inquiryId, 'APPROVED', {
      note: `Proposal v${proposal.version} accepted by ${normalizedEmail}`,
      metadata: { proposalId: proposal.id },
    });

    return updated;
  });
}

export async function declineProposal(publicToken: string, reason?: string) {
  return db.$transaction(async (tx) => {
    const proposal = await tx.proposal.findUniqueOrThrow({
      where: { publicToken },
      include: { inquiry: true },
    });

    if (!['SENT', 'VIEWED'].includes(proposal.status)) {
      throw new Error('Proposal cannot be declined in current state');
    }

    const updated = await tx.proposal.update({
      where: { id: proposal.id },
      data: { status: 'DECLINED', respondedAt: new Date() },
    });

    await transitionInquiryStatusTx(tx, proposal.inquiryId, 'LOST', {
      note: reason ?? 'Client declined proposal',
      metadata: { proposalId: proposal.id },
    });

    return updated;
  });
}

export async function createInvoiceFromProposal(proposalId: string, adminId?: string) {
  const { createRazorpayPaymentLink } = await import('@/lib/razorpay');
  const { createPaypalInvoice } = await import('@/lib/paypal');
  const { sendInvoiceEmail } = await import('@/lib/email');

  return db.$transaction(async (tx) => {
    const proposal = await tx.proposal.findUniqueOrThrow({
      where: { id: proposalId },
      include: { inquiry: true },
    });

    if (proposal.status !== 'ACCEPTED') {
      throw new Error('Invoice can only be created from an accepted proposal');
    }

    if (proposal.inquiry.status !== 'APPROVED') {
      throw new Error('Inquiry must be in APPROVED status');
    }

    const inquiry = proposal.inquiry;
    const lineItems = proposal.lineItems as unknown as LineItem[];
    const legacyMeta = inquiry.legacyMetadata as Record<string, unknown> | null;
    const appReq = legacyMeta?.applicationRequest as Record<string, unknown> | undefined;
    const experienceLevel =
      (appReq?.experienceLevel as keyof typeof ClientType) ||
      (inquiry.requirementType === 'EXECUTIVE_RESUME' ? 'EXECUTIVE' : 'MID_CAREER');

    const isIndia = inquiry.countryCode.toUpperCase() === 'IN';
    const paymentGateway = isIndia
      ? 'RAZORPAY'
      : ((appReq?.preferredGateway as string) || 'PAYPAL');

    const count = await tx.invoice.count();
    const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
    const invoiceNumber = `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}-${randomSuffix}`;

    const discountRate = proposal.subtotal > 0 ? proposal.discount / proposal.subtotal : 0;
    const taxRate = proposal.subtotal > 0 ? proposal.tax / proposal.subtotal : 0;

    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        clientName: inquiry.name,
        clientEmail: inquiry.email,
        clientPhone: inquiry.phone ?? '',
        clientType: experienceLevel as ClientType,
        country: inquiry.countryCode,
        currency: proposal.currency,
        currencySymbol: proposal.currencySymbol,
        exchangeRate: 1,
        lineItems: lineItems as unknown as Prisma.InputJsonValue,
        discountRate,
        discountAmount: proposal.discount,
        taxRate,
        taxAmount: proposal.tax,
        subtotalConverted: proposal.subtotal,
        processingFeeRate: 0,
        processingFeeConverted: 0,
        totalPayable: proposal.total,
        paymentGateway,
        status: 'PENDING',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        brandId: 'catalyst',
        sourceChannel: 'INQUIRE',
        salesInquiryId: inquiry.id,
        proposalId: proposal.id,
        notes: proposal.scopeSummary,
      },
    });

    let paymentUrl = '';
    if (paymentGateway === 'RAZORPAY') {
      try {
        const rpRes = await createRazorpayPaymentLink({ ...invoice, lineItems } as never);
        paymentUrl = rpRes.short_url;
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { razorpayLinkId: rpRes.id, razorpayLinkUrl: paymentUrl },
        });
      } catch (e) {
        console.error('Razorpay error on inquiry invoice:', e);
        throw new Error('Unable to create Razorpay payment link. Please try again.');
      }
    } else {
      try {
        const ppRes = await createPaypalInvoice({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          clientName: invoice.clientName,
          clientEmail: invoice.clientEmail,
          currency: invoice.currency,
          dueDate: invoice.dueDate,
          notes: proposal.title,
          lineItems,
          taxAmount: proposal.tax,
          discountAmount: proposal.discount,
          processingFeeAmount: 0,
        });
        paymentUrl = ppRes.paymentUrl;
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { paypalInvoiceId: ppRes.id, paypalPaymentUrl: paymentUrl },
        });
      } catch (e) {
        console.error('PayPal error on inquiry invoice:', e);
        throw new Error('Unable to create PayPal invoice. Please try again.');
      }
    }

    await transitionInquiryStatusTx(tx, inquiry.id, 'INVOICE_SENT', {
      adminId,
      note: `Invoice ${invoiceNumber} created from proposal`,
      metadata: { invoiceId: invoice.id, proposalId },
    });

    await tx.salesInquiry.update({
      where: { id: inquiry.id },
      data: { convertedInvoiceId: invoice.id },
    });

    await tx.inquiryActivityLog.create({
      data: {
        inquiryId: inquiry.id,
        action: 'INVOICE_CREATED',
        adminId,
        toStatus: 'INVOICE_SENT',
        note: `Invoice ${invoiceNumber} created from proposal`,
        metadata: { invoiceId: invoice.id, proposalId },
      },
    });

    const fullInvoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    if (fullInvoice.clientEmail && paymentUrl) {
      try {
        await sendInvoiceEmail(fullInvoice as unknown as Parameters<typeof sendInvoiceEmail>[0]);
      } catch (e) {
        console.error('Failed to send inquiry invoice email:', e);
      }
    }

    return { invoice: fullInvoice, paymentUrl };
  });
}
