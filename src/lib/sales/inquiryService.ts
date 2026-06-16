import type { Prisma, InquiryPriority, InquiryStatus } from '@prisma/client';
import { prisma as db } from '@/lib/db';
import { canTransitionInquiry } from './inquiryTransitions';
import {
  inquiryStatusToLeadStatus,
  inquiryStatusToLifecycleStage,
} from '@/lib/flywheel/inquiryStatusMap';
import {
  createWithGeneratedDisplayId,
  nextContactDisplayId,
  nextInquiryDisplayId,
} from '@/lib/displayIds';
import { computeAutoQualScore, scoreToPriority } from './autoQualification';
import {
  sendInquiryConfirmationEmail,
  notifyAdminNewLead,
} from './checkoutNotifications';

export interface CreateInquiryInput {
  name: string;
  email: string;
  phone?: string;
  countryCode: string;
  countryName: string;
  requirementType: string;
  servicesRequested: string[];
  requirementNotes?: string;
  sourceUrl?: string;
  utmJson?: Record<string, unknown>;
}

async function upsertInquireContact(tx: Prisma.TransactionClient, input: CreateInquiryInput) {
  let contact = await tx.contact.findFirst({
    where: { email: { equals: input.email, mode: 'insensitive' } },
    include: { flywheelProfile: true },
  });

  if (!contact) {
    contact = await createWithGeneratedDisplayId(
      'displayId',
      () => nextContactDisplayId(tx),
      (displayId) =>
        tx.contact.create({
          data: {
            displayId,
            name: input.name,
            email: input.email.toLowerCase().trim(),
            phone: input.phone,
            country: input.countryCode,
            contactSource: 'WEBSITE_INQUIRY',
            flywheelProfile: {
              create: {
                lifecycleStage: 'LEAD',
                leadStatus: 'NEW',
              },
            },
          },
          include: { flywheelProfile: true },
        })
    );
  } else {
    contact = await tx.contact.update({
      where: { id: contact.id },
      data: {
        name: input.name,
        phone: input.phone,
        country: input.countryCode,
      },
      include: { flywheelProfile: true },
    });

    if (!contact.flywheelProfile) {
      await tx.flywheelProfile.create({
        data: {
          contactId: contact.id,
          lifecycleStage: 'LEAD',
          leadStatus: 'NEW',
        },
      });
      contact = await tx.contact.findUniqueOrThrow({
        where: { id: contact.id },
        include: { flywheelProfile: true },
      });
    }
  }

  return contact;
}

export async function createSalesInquiry(input: CreateInquiryInput) {
  // Compute auto-qualification score before transaction
  const autoQualScore = computeAutoQualScore({
    requirementType: input.requirementType,
    servicesRequested: input.servicesRequested,
    countryCode: input.countryCode,
    requirementNotes: input.requirementNotes,
    phone: input.phone,
    email: input.email,
    name: input.name,
  });
  const priority = scoreToPriority(autoQualScore);

  const inquiry = await db.$transaction(async (tx) => {
    const contact = await upsertInquireContact(tx, input);
    const inq = await createWithGeneratedDisplayId(
      'displayId',
      () => nextInquiryDisplayId(tx),
      (displayId) =>
        tx.salesInquiry.create({
          data: {
            displayId,
            contactId: contact.id,
            flywheelProfileId: contact.flywheelProfile?.id,
            channel: 'INQUIRE',
            status: 'NEW',
            priority,
            autoQualScore,
            name: input.name,
            email: input.email.toLowerCase().trim(),
            phone: input.phone,
            countryCode: input.countryCode,
            countryName: input.countryName,
            requirementType: input.requirementType,
            servicesRequested: input.servicesRequested,
            requirementNotes: input.requirementNotes,
            sourceUrl: input.sourceUrl,
            utmJson: input.utmJson as Prisma.InputJsonValue | undefined,
          },
        })
    );

    await tx.inquiryActivityLog.create({
      data: {
        inquiryId: inq.id,
        action: 'INQUIRY_CREATED',
        toStatus: 'NEW',
        note: `Submitted via /inquire · Auto-score: ${autoQualScore} · Priority: ${priority}`,
      },
    });

    if (contact.flywheelProfile) {
      await tx.flywheelProfile.update({
        where: { id: contact.flywheelProfile.id },
        data: {
          leadStatus: inquiryStatusToLeadStatus('NEW'),
          lifecycleStage: inquiryStatusToLifecycleStage('NEW'),
          dealValue: null,
        },
      });
    }

    return inq;
  });

  // Post-transaction: dispatch emails & notifications (fire-and-forget)
  Promise.all([
    sendInquiryConfirmationEmail({
      name: input.name,
      email: input.email,
      displayId: inquiry.displayId,
      requirementType: input.requirementType,
      servicesRequested: input.servicesRequested,
    }).catch((e) => console.error('Failed to send inquiry confirmation email:', e)),
    notifyAdminNewLead({
      id: inquiry.id,
      displayId: inquiry.displayId,
      name: input.name,
      email: input.email,
      requirementType: input.requirementType,
      autoQualScore,
      priority,
    }).catch((e) => console.error('Failed to notify admin of new lead:', e)),
  ]);

  return inquiry;
}

export async function transitionInquiryStatusTx(
  tx: Prisma.TransactionClient,
  inquiryId: string,
  toStatus: InquiryStatus,
  opts: { adminId?: string; note?: string; metadata?: Record<string, unknown> } = {}
) {
  const inquiry = await tx.salesInquiry.findUniqueOrThrow({
    where: { id: inquiryId },
    include: { contact: { include: { flywheelProfile: true } } },
  });

  if (!canTransitionInquiry(inquiry.status, toStatus)) {
    throw new Error(`Invalid transition: ${inquiry.status} -> ${toStatus}`);
  }

  const updated = await tx.salesInquiry.update({
    where: { id: inquiryId },
    data: {
      status: toStatus,
      closedAt: ['CONVERTED', 'LOST', 'REJECTED'].includes(toStatus) ? new Date() : undefined,
    },
  });

  await tx.inquiryActivityLog.create({
    data: {
      inquiryId,
      action: 'STATUS_CHANGE',
      fromStatus: inquiry.status,
      toStatus,
      note: opts.note,
      adminId: opts.adminId,
      metadata: opts.metadata as Prisma.InputJsonValue | undefined,
    },
  });

  if (inquiry.contact?.flywheelProfile) {
    await tx.flywheelProfile.update({
      where: { id: inquiry.contact.flywheelProfile.id },
      data: {
        leadStatus: inquiryStatusToLeadStatus(toStatus),
        lifecycleStage: inquiryStatusToLifecycleStage(toStatus),
      },
    });
  }

  return updated;
}

export async function transitionInquiryStatus(
  inquiryId: string,
  toStatus: InquiryStatus,
  opts: { adminId?: string; note?: string; metadata?: Record<string, unknown> } = {}
) {
  return db.$transaction((tx) => transitionInquiryStatusTx(tx, inquiryId, toStatus, opts));
}

export async function assignInquiry(
  inquiryId: string,
  assignedToId: string | null,
  priority?: InquiryPriority,
  adminId?: string
) {
  return db.$transaction(async (tx) => {
    const updated = await tx.salesInquiry.update({
      where: { id: inquiryId },
      data: {
        assignedToId,
        ...(priority ? { priority } : {}),
      },
    });

    await tx.inquiryActivityLog.create({
      data: {
        inquiryId,
        action: 'ASSIGNED',
        adminId,
        note: assignedToId ? `Assigned to ${assignedToId}` : 'Unassigned',
        metadata: { priority },
      },
    });

    return updated;
  });
}

export async function addInquiryNote(inquiryId: string, note: string, adminId?: string) {
  return db.inquiryActivityLog.create({
    data: {
      inquiryId,
      action: 'NOTE',
      note,
      adminId,
    },
  });
}

export async function markInquiryConverted(inquiryId: string, invoiceId: string, clientId?: string) {
  return db.$transaction(async (tx) => {
    const current = await tx.salesInquiry.findUniqueOrThrow({
      where: { id: inquiryId },
      include: { contact: { include: { flywheelProfile: true } } },
    });

    const inquiry = await tx.salesInquiry.update({
      where: { id: inquiryId },
      data: {
        status: 'CONVERTED',
        convertedInvoiceId: invoiceId,
        convertedClientId: clientId,
        closedAt: new Date(),
      },
      include: { contact: { include: { flywheelProfile: true } } },
    });

    await tx.inquiryActivityLog.create({
      data: {
        inquiryId,
        action: 'CONVERTED',
        fromStatus: current.status,
        toStatus: 'CONVERTED',
        note: `Invoice ${invoiceId} paid`,
      },
    });

    if (current.contact?.flywheelProfile) {
      await tx.flywheelProfile.update({
        where: { id: current.contact.flywheelProfile.id },
        data: {
          leadStatus: 'QUALIFIED',
          lifecycleStage: 'CUSTOMER',
        },
      });
    }

    return inquiry;
  });
}

export async function listSalesInquiries(filters: {
  status?: InquiryStatus;
  page?: number;
  pageSize?: number;
  search?: string;
}) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const where: Prisma.SalesInquiryWhereInput = { channel: 'INQUIRE' };

  if (filters.status) where.status = filters.status;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
      { displayId: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    db.salesInquiry.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        proposals: { orderBy: { version: 'desc' }, take: 1 },
        activities: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    }),
    db.salesInquiry.count({ where }),
  ]);

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getSalesInquiry(id: string) {
  return db.salesInquiry.findUnique({
    where: { id },
    include: {
      contact: { include: { flywheelProfile: true } },
      proposals: { orderBy: { version: 'desc' } },
      activities: { orderBy: { createdAt: 'desc' } },
      invoices: true,
    },
  });
}
