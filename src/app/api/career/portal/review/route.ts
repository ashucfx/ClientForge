import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';
import { notifyAdmin } from '@/lib/notifications';
import sanitizeHtml from 'sanitize-html';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const { testimonial, designation, company, linkedinUrl } = body;

  if (!testimonial) {
    return NextResponse.json({ error: 'Testimonial is required' }, { status: 400 });
  }

  // Security Hardening: XSS Protection
  const cleanTestimonial = sanitizeHtml(testimonial, {
    allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    allowedAttributes: { 'a': ['href'] }
  });
  
  const cleanDesignation = designation ? sanitizeHtml(designation, { allowedTags: [], allowedAttributes: {} }) : null;
  const cleanCompany = company ? sanitizeHtml(company, { allowedTags: [], allowedAttributes: {} }) : null;
  const cleanLinkedinUrl = linkedinUrl ? sanitizeHtml(linkedinUrl, { allowedTags: [], allowedAttributes: {} }) : null;

  // Get the rating from the feedback
  const existingFeedback = await db.feedback.findUnique({
    where: { careerClientId: payload.clientId }
  });

  if (!existingFeedback) {
    return NextResponse.json({ error: 'Must submit feedback first' }, { status: 400 });
  }

  // Check if review already exists
  const existingReview = await db.review.findUnique({
    where: { careerClientId: payload.clientId }
  });

  if (existingReview) {
    return NextResponse.json({ error: 'Review already submitted' }, { status: 400 });
  }

  const review = await db.review.create({
    data: {
      careerClientId: payload.clientId,
      rating: existingFeedback.rating,
      testimonial: cleanTestimonial,
      designation: cleanDesignation,
      company: cleanCompany,
      linkedinUrl: cleanLinkedinUrl,
      isPublished: false // requires admin approval
    }
  });

  // Notify admins
  const admins = await db.adminUser.findMany({ select: { id: true } });
  for (const admin of admins) {
    await notifyAdmin({
      adminId: admin.id,
      title: '🌟 New Testimonial Submitted',
      message: `A client submitted a new testimonial. Pending approval.`,
      type: 'SUCCESS',
      link: '/admin/reviews'
    });
  }

  return NextResponse.json({ success: true, review }, { status: 201 });
}
