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

  if (leadId) {
    try {
      // Find if this open event already exists to prevent duplicates
      const existing = await db.flywheelEmailEvent.findFirst({
        where: {
          campaignLeadId: leadId,
          eventType: 'OPEN'
        }
      });

      if (!existing) {
        // Record the open
        await db.flywheelEmailEvent.create({
          data: {
            campaignLeadId: leadId,
            eventType: 'OPEN',
            metadata: {
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
