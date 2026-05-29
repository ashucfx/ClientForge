import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { sendCareerEmail } from '@/lib/career/email';
import { PORTAL_URL } from '@/lib/config';
import { deleteFromCloudinary } from '@/lib/career/cloudinary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const now = new Date();
  let warningCount = 0;
  let deletionCount = 0;

  // -------------------------------------------------------------------------
  // 1. Download Warning (25 days in COMPLETED)
  // -------------------------------------------------------------------------
  const twentyFiveDaysAgo = new Date(now);
  twentyFiveDaysAgo.setDate(twentyFiveDaysAgo.getDate() - 25);

  const warningClients = await db.careerClient.findMany({
    where: {
      status: 'COMPLETED',
      completedAt: { lte: twentyFiveDaysAgo },
    },
    select: { id: true, email: true, name: true },
  });

  for (const client of warningClients) {
    const existingLog = await db.careerEmailLog.findFirst({
      where: { clientId: client.id, trigger: 'CLEANUP_WARNING', status: 'sent' },
    });

    if (!existingLog) {
      await sendCareerEmail({
        to: client.email,
        trigger: 'MESSAGE_NOTIFY', // Re-using generic template
        clientId: client.id,
        data: {
          recipientName: client.name,
          senderType: 'admin',
          portalUrl: `${PORTAL_URL}/portal/dashboard`,
          subject: 'Important: Download your files before they are securely deleted',
          body: `Hi ${client.name.split(' ')[0]},\n\nFor your privacy and data security, our system automatically deletes all draft and intermediate documents 30 days after your project is completed.\n\nYour 30-day window is almost up. Please log in to your dashboard and download any files you wish to keep within the next 5 days!`,
        },
      });

      await db.careerEmailLog.create({
        data: { clientId: client.id, trigger: 'CLEANUP_WARNING', status: 'sent' },
      });
      warningCount++;
    }
  }

  // -------------------------------------------------------------------------
  // 2. Permanent Deletion (30 days in COMPLETED)
  // -------------------------------------------------------------------------
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const cleanupClients = await db.careerClient.findMany({
    where: {
      status: 'COMPLETED',
      completedAt: { lte: thirtyDaysAgo },
    },
    select: { id: true },
  });

  for (const client of cleanupClients) {
    // Only fetch 'draft' files. 'final' deliverables are kept.
    const draftsToDelete = await db.careerDeliverable.findMany({
      where: {
        clientId: client.id,
        fileCategory: 'draft',
      },
    });

    if (draftsToDelete.length > 0) {
      for (const draft of draftsToDelete) {
        // 1. Delete from Cloudinary
        try {
          await deleteFromCloudinary(draft.publicId);
        } catch (err) {
          console.error(`Failed to delete file from Cloudinary (publicId: ${draft.publicId}):`, err);
          continue; // Skip DB deletion if Cloudinary fails, so we can retry next time
        }

        // 2. Delete from Database
        await db.careerDeliverable.delete({
          where: { id: draft.id },
        });

        deletionCount++;
      }

      // Log the cleanup event
      await db.careerActivityLog.create({
        data: {
          clientId: client.id,
          action: 'file_deleted',
          performedBy: 'system',
          metadata: { reason: '30-day auto-cleanup', deletedCount: draftsToDelete.length },
        },
      });
    }
  }

  return NextResponse.json({ ok: true, warningsSent: warningCount, draftsDeleted: deletionCount });
}
