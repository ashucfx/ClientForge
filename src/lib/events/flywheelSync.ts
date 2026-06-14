import { prisma as db } from '@/lib/db';
import { WorkflowEventPayload } from './dispatcher';
import { waitUntil } from '@vercel/functions';

export async function syncFlywheelOnInvoicePaid(payload: WorkflowEventPayload & { amount: number; date: Date; contactId?: string }) {
  if (!payload.contactId || !payload.entityId) return;

  const { contactId, amount, date, entityId } = payload;

  waitUntil(
    (async () => {
      try {
        await db.$transaction(async (tx: any) => {
          // Idempotency check
          await tx.processedEvent.create({
            data: { eventType: 'INVOICE_PAID', eventId: entityId }
          });

          // 1. Update Profile
          await tx.flywheelProfile.upsert({
            where: { contactId },
            update: {
              totalRevenue: { increment: amount },
              invoiceCount: { increment: 1 },
              lastInvoiceDate: date,
              leadStatus: 'QUALIFIED',
              lifecycleStage: 'CUSTOMER'
            },
            create: {
              contactId,
              totalRevenue: amount,
              invoiceCount: 1,
              lastInvoiceDate: date,
              leadStatus: 'QUALIFIED',
              lifecycleStage: 'CUSTOMER'
            }
          });
        });
      } catch (err: any) {
        if (err.code === 'P2002') return; // Idempotent
        console.error('[FlywheelSync] Error syncing invoice paid event:', err);
      }
    })()
  );
}

export async function syncFlywheelOnClientCreated(payload: WorkflowEventPayload & { contactId?: string, isReactivation?: boolean }) {
  if (!payload.contactId || !payload.entityId) return;

  const { contactId, entityId } = payload;

  waitUntil(
    (async () => {
      try {
        await db.$transaction(async (tx: any) => {
          await tx.processedEvent.create({
            data: { eventType: 'CLIENT_CREATED', eventId: entityId }
          });

          await tx.flywheelProfile.upsert({
            where: { contactId },
            update: {}, // Do nothing if it exists
            create: {
              contactId,
              leadStatus: 'CONTACTED',
              lifecycleStage: 'LEAD',
              engagementScore: 5
            }
          });
        });
      } catch (err: any) {
        if (err.code === 'P2002') return;
        console.error('[FlywheelSync] Error syncing client created event:', err);
      }
    })()
  );
}

export async function syncFlywheelOnProjectDelivered(payload: WorkflowEventPayload & { contactId?: string }) {
  if (!payload.contactId || !payload.entityId) return;

  waitUntil(
    (async () => {
      try {
        await db.$transaction(async (tx: any) => {
          await tx.processedEvent.create({
            data: { eventType: 'PROJECT_DELIVERED', eventId: payload.entityId }
          });

          await tx.flywheelProfile.update({
            where: { contactId: payload.contactId },
            data: {
              lastServiceDate: new Date(),
              engagementScore: { increment: 10 }
            }
          });
        });
      } catch (err: any) {
        if (err.code === 'P2002') return;
        console.error('[FlywheelSync] Error syncing project delivered event:', err);
      }
    })()
  );
}

export async function syncFlywheelOnClientArchived(payload: WorkflowEventPayload & { contactId?: string }) {
  if (!payload.contactId || !payload.entityId) return;

  waitUntil(
    (async () => {
      try {
        await db.$transaction(async (tx: any) => {
          await tx.processedEvent.create({
            data: { eventType: 'CLIENT_ARCHIVED', eventId: payload.entityId }
          });

          await tx.flywheelProfile.update({
            where: { contactId: payload.contactId },
            data: {
              lifecycleStage: 'CHURNED',
              leadStatus: 'REACTIVATION_TARGET'
            }
          });
        });
      } catch (err: any) {
        if (err.code === 'P2002') return;
        console.error('[FlywheelSync] Error syncing client archived event:', err);
      }
    })()
  );
}

export async function syncFlywheelOnReviewReceived(payload: WorkflowEventPayload & { contactId?: string, rating?: number }) {
  if (!payload.contactId || !payload.entityId) return;

  waitUntil(
    (async () => {
      try {
        await db.$transaction(async (tx: any) => {
          await tx.processedEvent.create({
            data: { eventType: 'REVIEW_RECEIVED', eventId: payload.entityId }
          });

          const inc = (payload.rating && payload.rating >= 4) ? 15 : 5;

          await tx.flywheelProfile.update({
            where: { contactId: payload.contactId },
            data: { engagementScore: { increment: inc } }
          });
        });
      } catch (err: any) {
        if (err.code === 'P2002') return;
      }
    })()
  );
}

export async function syncFlywheelOnRevisionRequested(payload: WorkflowEventPayload & { contactId?: string }) {
  if (!payload.contactId || !payload.entityId) return;

  waitUntil(
    (async () => {
      try {
        await db.$transaction(async (tx: any) => {
          await tx.processedEvent.create({
            data: { eventType: 'REVISION_REQUESTED', eventId: payload.entityId }
          });

          await tx.flywheelProfile.update({
            where: { contactId: payload.contactId },
            data: { engagementScore: { decrement: 2 } }
          });
        });
      } catch (err: any) {
        if (err.code === 'P2002') return;
      }
    })()
  );
}

export async function syncFlywheelOnDeliverableUploaded(payload: WorkflowEventPayload & { contactId?: string }) {
  if (!payload.contactId || !payload.entityId) return;

  waitUntil(
    (async () => {
      try {
        await db.$transaction(async (tx: any) => {
          await tx.processedEvent.create({
            data: { eventType: 'DELIVERABLE_UPLOADED', eventId: payload.entityId }
          });

          await tx.flywheelProfile.update({
            where: { contactId: payload.contactId },
            data: {
              lastServiceDate: new Date(),
              engagementScore: { increment: 5 }
            }
          });
        });
      } catch (err: any) {
        if (err.code === 'P2002') return;
      }
    })()
  );
}
