import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { verifyRnClientSession } from '@/lib/rn/auth';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const tokenCookie = cookies().get('rn_client_session')?.value;
  const session = tokenCookie ? await verifyRnClientSession(tokenCookie) : null;
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const { rating, testimonial, designation, company, linkedinUrl } = body;

  if (!rating || !testimonial) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const client = await db.rnClient.findUnique({
    where: { id: session.clientId }
  });

  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const existingReview = await db.review.findUnique({
    where: { rnClientId: client.id }
  });

  if (existingReview) {
    return NextResponse.json({ error: 'Review already submitted' }, { status: 400 });
  }

  const review = await db.review.create({
    data: {
      rnClientId: client.id,
      rating,
      testimonial,
      designation,
      company,
      linkedinUrl,
      isPublished: false
    }
  });

  return NextResponse.json({ success: true, review }, { status: 201 });
}
