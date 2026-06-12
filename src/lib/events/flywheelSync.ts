import { prisma as db } from '@/lib/db';
import { WorkflowEventPayload } from './dispatcher';
import { waitUntil } from '@vercel/functions';

export async function syncFlywheelOnInvoicePaid(payload: WorkflowEventPayload & { amount: number; date: Date; contactId?: string }) {
  if (!payload.contactId || !payload.entityId) return;

  const { contactId, amount, date, tenantContext, entityId } = payload;
  const brandId = tenantContext.tenantId;
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);
  normalizedDate.setDate(1); // Aggregation by month

  waitUntil(
    (async () => {
      try {
        await db.$transaction(async (tx: any) => {
          // Idempotency check: Will throw P2002 if duplicate, aborting the transaction
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

          // 2. Update Monthly Revenue Metrics
          await tx.flywheelRevenueMetrics.upsert({
            where: {
              date_brandId: {
                date: normalizedDate,
                brandId
              }
            },
            update: {
              totalCollected: { increment: amount },
              oneTimeRevenue: { increment: amount }
            },
            create: {
              date: normalizedDate,
              brandId,
              totalCollected: amount,
              oneTimeRevenue: amount
            }
          });
        });
      } catch (err: any) {
        if (err.code === 'P2002') {
          console.log(`[FlywheelSync] INVOICE_PAID event ${entityId} already processed. Idempotency prevented duplicate.`);
          return;
        }
        console.error('[FlywheelSync] Error syncing invoice paid event:', err);
      }
    })()
  );
}

export async function syncFlywheelOnClientCreated(payload: WorkflowEventPayload & { contactId?: string, isReactivation?: boolean }) {
  if (!payload.contactId || !payload.entityId) return;

  const { contactId, tenantContext, isReactivation, entityId } = payload;
  const brandId = tenantContext.tenantId;
  const normalizedDate = new Date();
  normalizedDate.setHours(0, 0, 0, 0);
  normalizedDate.setDate(1);

  waitUntil(
    (async () => {
      try {
        await db.$transaction(async (tx: any) => {
          await tx.processedEvent.create({
            data: { eventType: 'CLIENT_CREATED', eventId: entityId }
          });

          // 1. Profile Setup
          await tx.flywheelProfile.upsert({
            where: { contactId },
            update: {}, // Do nothing if it exists, profile is set
            create: {
              contactId,
              leadStatus: 'CONTACTED',
              lifecycleStage: 'LEAD',
              engagementScore: 5
            }
          });

          // 2. Client Metrics Update
          await tx.flywheelClientMetrics.upsert({
            where: {
              date_brandId: {
                date: normalizedDate,
                brandId
              }
            },
            update: isReactivation 
              ? { reactivatedCount: { increment: 1 }, activeCount: { increment: 1 } }
              : { newAcquisitions: { increment: 1 }, activeCount: { increment: 1 } },
            create: {
              date: normalizedDate,
              brandId,
              newAcquisitions: isReactivation ? 0 : 1,
              reactivatedCount: isReactivation ? 1 : 0,
              activeCount: 1
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

  const brandId = payload.tenantContext.tenantId;
  const normalizedDate = new Date();
  normalizedDate.setHours(0, 0, 0, 0);
  normalizedDate.setDate(1);

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

          await tx.flywheelClientMetrics.upsert({
            where: {
              date_brandId: {
                date: normalizedDate,
                brandId
              }
            },
            update: {
              churnedCount: { increment: 1 },
              activeCount: { decrement: 1 }
            },
            create: {
              date: normalizedDate,
              brandId,
              churnedCount: 1,
              activeCount: 0
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
