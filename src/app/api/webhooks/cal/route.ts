import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import crypto from 'crypto';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-cal-signature-256');
    const secret = process.env.CAL_WEBHOOK_SECRET;

    if (secret && signature) {
      const hmac = crypto.createHmac('sha256', secret);
      const computedSignature = hmac.update(rawBody).digest('hex');
      if (signature !== computedSignature) {
        console.warn('[Cal.com Webhook] Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } else if (secret && !signature) {
      console.warn('[Cal.com Webhook] Missing signature');
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const trigger = body.triggerEvent;
    
    if (trigger === 'BOOKING_CREATED') {
      const payload = body.payload;
      
      // Cal.com puts custom fields in `responses` or `metadata` depending on how it's passed.
      // Usually, if we pass ?clientId=xyz to the booking link as a pre-filled hidden field, 
      // it appears in payload.responses.clientId or payload.metadata.clientId
      let clientId = payload?.metadata?.clientId || payload?.responses?.clientId?.value || payload?.responses?.clientId;
      
      // Also check if it's passed in the URL (unlikely for a global webhook, but possible)
      if (!clientId && req.nextUrl.searchParams.get('clientId')) {
        clientId = req.nextUrl.searchParams.get('clientId');
      }

      if (clientId) {
        // Extract start time and join URL
        const startTime = payload.startTime; // ISO String
        const joinUrl = payload.videoCallData?.url || payload.location || null;

        await db.careerClient.update({
          where: { id: clientId },
          data: {
            consultationStatus: 'BOOKED',
            consultationScheduledAt: new Date(startTime),
            consultationJoinUrl: joinUrl
          }
        });

        // Optionally, log an activity
        await db.careerActivityLog.create({
          data: {
            clientId,
            action: 'consultation_booked',
            performedBy: 'client',
            metadata: { startTime, joinUrl }
          }
        });
        
        return NextResponse.json({ ok: true, message: 'Consultation booked successfully' });
      } else {
        console.warn('[Cal.com Webhook] Missing clientId in payload:', payload);
        return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
      }
    }
    
    if (trigger === 'BOOKING_CANCELLED' || trigger === 'BOOKING_REJECTED') {
      const payload = body.payload;
      let clientId = payload?.metadata?.clientId || payload?.responses?.clientId?.value || payload?.responses?.clientId;
      
      if (clientId) {
        await db.careerClient.update({
          where: { id: clientId },
          data: {
            consultationStatus: 'PENDING',
            consultationScheduledAt: null,
            consultationJoinUrl: null
          }
        });
        return NextResponse.json({ ok: true, message: 'Consultation cancelled' });
      }
    }

    if (trigger === 'MEETING_ENDED') {
      const payload = body.payload;
      let clientId = payload?.metadata?.clientId || payload?.responses?.clientId?.value || payload?.responses?.clientId;
      
      if (clientId) {
        await db.careerClient.update({
          where: { id: clientId },
          data: {
            consultationStatus: 'COMPLETED'
          }
        });
        return NextResponse.json({ ok: true, message: 'Consultation completed' });
      }
    }

    return NextResponse.json({ ok: true, ignored: true });
  } catch (error) {
    console.error('[Cal.com Webhook Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
