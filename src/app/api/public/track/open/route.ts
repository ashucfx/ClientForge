import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';

// 1x1 transparent GIF base64
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const leadId = url.searchParams.get('lead');
  const step = url.searchParams.get('step');

  if (leadId) {
    try {
      // Dedup per EMAIL, not per lead: a drip lead opens step 1, then step 2 —
      // both must count. When a step is present, only dedup within that step.
      const existing = await db.flywheelEmailEvent.findFirst({
        where: {
          campaignLeadId: leadId,
          eventType: 'OPEN',
          ...(step ? { metadata: { path: ['step'], equals: step } } : {}),
        }
      });

      if (!existing) {
        // Record the open
        await db.flywheelEmailEvent.create({
          data: {
            campaignLeadId: leadId,
            eventType: 'OPEN',
            metadata: {
              ...(step ? { step } : {}),
              userAgent: req.headers.get('user-agent'),
              ip: req.headers.get('x-forwarded-for') || req.ip
            }
          }
        });
      }
    } catch (e) {
      // Silently fail so the image still loads
      console.error('[OpenTracking] Failed to log:', e);
    }
  }

  // Always return the 1x1 transparent GIF
  return new NextResponse(TRANSPARENT_GIF, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0'
    }
  });
}
