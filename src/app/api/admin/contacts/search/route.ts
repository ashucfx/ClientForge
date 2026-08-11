// GET /api/admin/contacts/search
// Returns a deduplicated list of existing clients/contacts matching the query.
// Respects the admin's activeTenant so cross-brand data is never exposed.
// Query params: q (search string, min 2 chars), limit (default 10, max 25)

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? '10'), 25);

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const like = `%${q}%`;
  void like; // suppress unused-var warning (kept for raw SQL fallback reference)
  const { activeTenant } = session;

  // ── 1. Search Contacts (shared registry) ──────────────────────────────────
  const contacts = await prisma.contact.findMany({
    where: {
      status: { not: 'MERGED' },
      OR: [
        { name:  { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { displayId: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      displayId: true,
      name: true,
      email: true,
      phone: true,
      companyName: true,
      country: true,
    },
    take: limit,
  });

  // ── 2. Search brand-specific client tables ─────────────────────────────────
  type Candidate = {
    id: string;
    sourceType: 'contact' | 'career_client' | 'rn_client';
    name: string;
    email: string | null;
    phone: string | null;
    companyName: string | null;
    country: string | null;
    displayId?: string | null;
  };

  const results: Candidate[] = contacts.map((c: typeof contacts[number]) => ({
    id: c.id,
    sourceType: 'contact' as const,
    name: c.name,
    email: c.email ?? null,
    phone: c.phone ?? null,
    companyName: c.companyName ?? null,
    country: c.country ?? null,
    displayId: c.displayId,
  }));

  const seenEmails = new Set(contacts.filter((c: typeof contacts[number]) => c.email).map((c: typeof contacts[number]) => c.email!.toLowerCase()));

  if (activeTenant === 'catalyst' || session.brandAccess.includes('catalyst')) {
    const careerClients = await prisma.careerClient.findMany({
      where: {
        OR: [
          { name:  { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, email: true, phone: true, contact: { select: { country: true } } },
      take: limit,
    });

    for (const c of careerClients) {
      if (c.email && !seenEmails.has(c.email.toLowerCase())) {
        seenEmails.add(c.email.toLowerCase());
        results.push({ id: c.id, sourceType: 'career_client', name: c.name, email: c.email, phone: c.phone ?? null, companyName: null, country: c.contact?.country ?? null });
      }
    }
  }

  if (activeTenant === 'ripple_nexus' || session.brandAccess.includes('ripple_nexus')) {
    const rnClients = await prisma.rnClient.findMany({
      where: {
        OR: [
          { name:  { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, email: true, phone: true, companyName: true, country: true },
      take: limit,
    });

    for (const c of rnClients) {
      if (!seenEmails.has(c.email.toLowerCase())) {
        seenEmails.add(c.email.toLowerCase());
        results.push({ id: c.id, sourceType: 'rn_client', name: c.name, email: c.email, phone: c.phone ?? null, companyName: c.companyName ?? null, country: c.country ?? null });
      }
    }
  }

  // Sort: exact email matches first, then name contains match
  results.sort((a, b) => {
    const aExact = a.email?.toLowerCase() === q.toLowerCase() ? 0 : 1;
    const bExact = b.email?.toLowerCase() === q.toLowerCase() ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    return a.name.localeCompare(b.name);
  });

  return NextResponse.json({ results: results.slice(0, limit) });
}
