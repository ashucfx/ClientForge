import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { resolveServices } from '@/lib/career/services';
import type { CareerServiceSlug } from '@/lib/career/types';

export const runtime = 'nodejs';

const VALID_SLUGS = new Set<CareerServiceSlug>([
  'RESUME',
  'COVER_LETTER',
  'LINKEDIN',
  'PORTFOLIO',
  'FULL_PACKAGE',
  'PREMIUM_PLUS',
  'EXECUTIVE_CONNECT',
]);

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const engagements = await db.careerEngagement.findMany({
    where: { clientId: params.id },
    orderBy: { sequence: 'desc' },
  });

  return NextResponse.json({ engagements });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as { services?: unknown; notes?: unknown } | null;
  const requestedSlugs = Array.isArray(body?.services)
    ? [...new Set(body.services.filter((slug): slug is CareerServiceSlug => typeof slug === 'string' && VALID_SLUGS.has(slug as CareerServiceSlug)))]
    : [];

  if (requestedSlugs.length === 0) {
    return NextResponse.json({ error: 'Select at least one add-on service' }, { status: 400 });
  }

  const client = await db.careerClient.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
      services: { select: { service: { select: { slug: true, name: true } } } },
    },
  });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const addedServiceRecords = await resolveServices(requestedSlugs);
  const previousServices = client.services.map(({ service }) => ({
    slug: service.slug,
    name: service.name,
  }));
  const addedServices = addedServiceRecords.map(service => ({
    slug: service.slug,
    name: service.name,
  }));

  try {
    const result = await db.$transaction(async tx => {
      const currentSequence = await tx.careerEngagement.aggregate({
        where: { clientId: client.id },
        _max: { sequence: true },
      });
      const sequence = (currentSequence._max.sequence ?? 0) + 1;

      const engagement = await tx.careerEngagement.create({
        data: {
          clientId: client.id,
          sequence,
          previousServices,
          addedServices,
        },
      });

      for (const service of addedServiceRecords) {
        await tx.careerClientService.upsert({
          where: { clientId_serviceId: { clientId: client.id, serviceId: service.id } },
          create: { clientId: client.id, serviceId: service.id },
          update: {},
        });
      }

      await tx.careerClient.update({
        where: { id: client.id },
        data: {
          status: 'NOT_STARTED',
          waitingOn: 'AGENCY',
          reEngagedAt: engagement.startedAt,
          reEngagedFrom: client.status,
          activityLogs: {
            create: {
              action: 'client_re_onboarded',
              performedBy: 'admin',
              metadata: {
                engagementId: engagement.id,
                sequence,
                previousServices,
                addedServices,
                notes: typeof body?.notes === 'string' ? body.notes.trim() : undefined,
              },
            },
          },
        },
      });

      return engagement;
    }, { isolationLevel: 'Serializable' });

    return NextResponse.json({ engagement: result }, { status: 201 });
  } catch (error) {
    console.error('[career/engagements] Failed to create re-onboarding engagement:', error);
    return NextResponse.json({ error: 'Could not create re-onboarding engagement' }, { status: 500 });
  }
}
