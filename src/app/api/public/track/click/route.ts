import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const leadId = url.searchParams.get('lead');
  const step = url.searchParams.get('step');
  const destination = url.searchParams.get('url');

  if (!destination) {
    return NextResponse.redirect('https://theripplenexus.com', { status: 302 });
  }

  // Decode and validate destination — only allow http/https
  let dest: string;
  try {
    dest = decodeURIComponent(destination);
    const parsed = new URL(dest);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return NextResponse.redirect('https://theripplenexus.com', { status: 302 });
    }
  } catch {
    return NextResponse.redirect('https://theripplenexus.com', { status: 302 });
  }

  if (leadId) {
    db.flywheelEmailEvent.create({
      data: {
        campaignLeadId: leadId,
        eventType: 'CLICK',
        metadata: {
          ...(step ? { step } : {}),
          url: dest,
          userAgent: req.headers.get('user-agent'),
          ip: req.headers.get('x-forwarded-for') ?? '',
        },
      },
    }).catch(() => null); // fire-and-forget, don't block the redirect
  }

  return NextResponse.redirect(dest, { status: 302 });
}
