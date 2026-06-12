import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { reviewId, action } = await req.json();

    if (!reviewId || !action) {
      return NextResponse.json({ success: false, error: 'Missing reviewId or action' }, { status: 400 });
    }

    const review = await db.contactMergeReview.findUnique({
      where: { id: reviewId },
      include: { sourceContact: true, targetContact: true }
    });

    if (!review) {
      return NextResponse.json({ success: false, error: 'Review record not found' }, { status: 404 });
    }

    if (review.status !== 'PENDING') {
      return NextResponse.json({ success: false, error: 'Review is already resolved' }, { status: 400 });
    }

    if (action === 'MERGE') {
      await db.$transaction(async (tx) => {
        // Move CareerClients
        await tx.careerClient.updateMany({
          where: { contactId: review.sourceContactId },
          data: { contactId: review.targetContactId }
        });

        // Move RnClients
        await tx.rnClient.updateMany({
          where: { contactId: review.sourceContactId },
          data: { contactId: review.targetContactId }
        });

        // Merge FlywheelProfile
        const sourceFlywheel = await tx.flywheelProfile.findUnique({
          where: { contactId: review.sourceContactId }
        });

        if (sourceFlywheel) {
          const revToAdd = sourceFlywheel.totalRevenue || 0;
          const invoicesToAdd = sourceFlywheel.invoiceCount || 0;

          await tx.flywheelProfile.upsert({
            where: { contactId: review.targetContactId },
            update: {
              totalRevenue: { increment: revToAdd },
              invoiceCount: { increment: invoicesToAdd },
              // Optional: merge tags/services purchased can be done here if needed
            },
            create: {
              contactId: review.targetContactId,
              totalRevenue: revToAdd,
              invoiceCount: invoicesToAdd,
              leadStatus: sourceFlywheel.leadStatus,
              lifecycleStage: sourceFlywheel.lifecycleStage
            }
          });
          
          // Optionally delete the source flywheel profile since the contact is merged
          await tx.flywheelProfile.delete({
            where: { id: sourceFlywheel.id }
          });
        }

        // Keep source contact, but mark as MERGED and link it
        await tx.contact.update({
          where: { id: review.sourceContactId },
          data: {
            status: 'MERGED',
            mergedIntoContactId: review.targetContactId
          }
        });

        // Mark review as MERGED
        await tx.contactMergeReview.update({
          where: { id: reviewId },
          data: { status: 'MERGED' }
        });

        // Audit Log
        await tx.auditLog.create({
          data: {
            tenantId: 'system',
            adminId: session.adminId,
            action: 'CONTACT_MERGE_RESOLVE',
            entity: 'ContactMergeReview',
            entityId: reviewId,
            changes: { sourceContact: review.sourceContactId, targetContact: review.targetContactId }
          }
        });
      });

      return NextResponse.json({ success: true, message: 'Merged successfully' });

    } else if (action === 'SPLIT') {
      await db.$transaction(async (tx) => {
        await tx.contactMergeReview.update({
          where: { id: reviewId },
          data: { status: 'REJECTED_NEW' }
        });

        await tx.auditLog.create({
          data: {
            tenantId: 'system',
            adminId: session.adminId,
            action: 'CONTACT_MERGE_SPLIT',
            entity: 'ContactMergeReview',
            entityId: reviewId,
            changes: { sourceContact: review.sourceContactId, targetContact: review.targetContactId }
          }
        });
      });

      return NextResponse.json({ success: true, message: 'Split successfully (kept as new)' });
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('[MergeResolve] POST Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to resolve merge' }, { status: 500 });
  }
}
