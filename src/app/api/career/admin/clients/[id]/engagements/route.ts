import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { resolveServices } from '@/lib/career/services';
import { generateMagicToken, magicTokenExpiry } from '@/lib/career/auth';
import { sendCareerEmail } from '@/lib/career/email';
import { PACKAGE_LABELS, SERVICE_LABELS } from '@/lib/career/types';
import { PORTAL_URL } from '@/lib/config';
import type { CareerPackage, CareerServiceSlug } from '@/lib/career/types';

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

type ServiceSnapshot = { slug: string; name: string };

function readServiceSnapshot(value: unknown): ServiceSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): ServiceSnapshot[] => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (typeof record.slug !== 'string' || typeof record.name !== 'string') return [];
    return [{ slug: record.slug, name: record.name }];
  });
}

function readRequestedSlugs(value: unknown): CareerServiceSlug[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((slug): slug is CareerServiceSlug =>
    typeof slug === 'string' && VALID_SLUGS.has(slug as CareerServiceSlug),
  ))];
}

async function replacePendingEngagementEmails(clientId: string, engagementId: string) {
  const pendingEmails = await db.emailQueue.findMany({
    where: {
      clientId,
      trigger: 'REENGAGEMENT',
      status: { in: ['PENDING', 'FAILED', 'PROCESSING'] },
    },
    select: { id: true, status: true, data: true },
  });
  const related = pendingEmails.filter(email => {
    const payload = email.data as Record<string, unknown> | null;
    const metadata = payload?.logMetadata as Record<string, unknown> | undefined;
    return metadata?.engagementId === engagementId;
  });

  if (related.some(email => email.status === 'PROCESSING')) return false;

  const retryIds = related
    .filter(email => email.status === 'PENDING' || email.status === 'FAILED')
    .map(email => email.id);
  if (retryIds.length > 0) {
    await db.emailQueue.updateMany({
      where: { id: { in: retryIds }, status: { in: ['PENDING', 'FAILED'] } },
      data: { status: 'CANCELLED', error: null },
    });
  }

  // A cron worker may have claimed a retry between the read and cancellation.
  const claimed = await db.emailQueue.findMany({
    where: { id: { in: retryIds }, status: 'PROCESSING' },
    select: { id: true },
  });
  return claimed.length === 0;
}

async function queueEngagementEmail(clientId: string, engagement: {
  id: string;
  sequence: number;
  addedServices: unknown;
}) {
  const client = await db.careerClient.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      email: true,
      packageType: true,
      magicToken: true,
      magicTokenExpiry: true,
      services: { select: { service: { select: { slug: true, name: true } } } },
      deliverables: {
        where: { fileCategory: 'final' },
        orderBy: { createdAt: 'desc' },
        select: { label: true, fileUrl: true },
      },
    },
  });
  if (!client) throw new Error('Client not found');

  const token = generateMagicToken();
  const tokenExpiry = magicTokenExpiry();
  await db.careerClient.update({
    where: { id: client.id },
    data: { magicToken: token, magicTokenExpiry: tokenExpiry },
  });

  const packageLabel = client.services.length > 0
    ? client.services.map(({ service }) => SERVICE_LABELS[service.slug as CareerServiceSlug] ?? service.name).join(', ')
    : PACKAGE_LABELS[client.packageType as CareerPackage] ?? 'Career Services';
  const addedServices = readServiceSnapshot(engagement.addedServices)
    .map(service => SERVICE_LABELS[service.slug as CareerServiceSlug] ?? service.name);
  const files = client.deliverables.map(file => ({ label: file.label, url: file.fileUrl }));
  const portalUrl = `${PORTAL_URL.replace(/\/$/, '')}/portal/login?token=${encodeURIComponent(token)}`;

  try {
    const queueId = await sendCareerEmail({
      to: client.email,
      trigger: 'REENGAGEMENT',
      clientId: client.id,
      logMetadata: { engagementId: engagement.id, engagementSequence: engagement.sequence },
      data: {
        name: client.name,
        packageLabel,
        portalUrl,
        engagementSequence: engagement.sequence,
        addedServices,
        files,
      },
    });
    if (!queueId) throw new Error('The email was not added to the delivery queue.');

    await db.careerActivityLog.create({
      data: {
        clientId: client.id,
        action: 'reengagement_email_queued',
        performedBy: 'admin',
        metadata: { engagementId: engagement.id, sequence: engagement.sequence, queueId },
      },
    }).catch(error => console.error('[career/engagements] Could not record email activity:', error));

    return queueId;
  } catch (error) {
    // If the queue could not accept the email, restore the prior link only if
    // this request's token is still current (a newer sign-in request may exist).
    await db.careerClient.updateMany({
      where: { id: client.id, magicToken: token },
      data: { magicToken: client.magicToken, magicTokenExpiry: client.magicTokenExpiry },
    }).catch(() => null);
    throw error;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [engagements, queuedEmails] = await Promise.all([
    db.careerEngagement.findMany({
      where: { clientId: params.id },
      orderBy: { sequence: 'desc' },
    }),
    db.emailQueue.findMany({
      where: { clientId: params.id, trigger: 'REENGAGEMENT' },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { status: true, error: true, data: true, createdAt: true },
    }),
  ]);

  const latestEmailByEngagement = new Map<string, { status: string; error: string | null; createdAt: Date }>();
  for (const queuedEmail of queuedEmails) {
    const payload = queuedEmail.data as Record<string, unknown> | null;
    const logMetadata = payload?.logMetadata as Record<string, unknown> | undefined;
    const engagementId = typeof logMetadata?.engagementId === 'string' ? logMetadata.engagementId : null;
    if (engagementId && !latestEmailByEngagement.has(engagementId)) {
      latestEmailByEngagement.set(engagementId, {
        status: queuedEmail.status,
        error: queuedEmail.error,
        createdAt: queuedEmail.createdAt,
      });
    }
  }

  return NextResponse.json({
    engagements: engagements.map(engagement => ({
      ...engagement,
      emailStatus: latestEmailByEngagement.get(engagement.id)?.status ?? null,
      emailError: latestEmailByEngagement.get(engagement.id)?.error ?? null,
      emailUpdatedAt: latestEmailByEngagement.get(engagement.id)?.createdAt ?? null,
    })),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as { services?: unknown; notes?: unknown } | null;
  const requestedSlugs = readRequestedSlugs(body?.services);
  if (requestedSlugs.length === 0) {
    return NextResponse.json({ error: 'Select at least one additional service' }, { status: 400 });
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
  const previousServices = client.services.map(({ service }) => ({ slug: service.slug, name: service.name }));
  const addedServices = addedServiceRecords.map(service => ({ slug: service.slug, name: service.name }));

  let engagement;
  try {
    engagement = await db.$transaction(async tx => {
      const currentSequence = await tx.careerEngagement.aggregate({
        where: { clientId: client.id },
        _max: { sequence: true },
      });
      const sequence = (currentSequence._max.sequence ?? 0) + 1;
      const createdEngagement = await tx.careerEngagement.create({
        data: { clientId: client.id, sequence, previousServices, addedServices },
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
          reEngagedAt: createdEngagement.startedAt,
          reEngagedFrom: client.status,
          activityLogs: {
            create: {
              action: 'client_re_onboarded',
              performedBy: 'admin',
              metadata: {
                engagementId: createdEngagement.id,
                sequence,
                previousServices,
                addedServices,
                notes: typeof body?.notes === 'string' ? body.notes.trim() : undefined,
              },
            },
          },
        },
      });
      return createdEngagement;
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    console.error('[career/engagements] Failed to create re-onboarding engagement:', error);
    return NextResponse.json({ error: 'Could not create re-onboarding engagement' }, { status: 500 });
  }

  try {
    const emailQueueId = await queueEngagementEmail(client.id, engagement);
    return NextResponse.json({ engagement, emailQueued: true, emailQueueId }, { status: 201 });
  } catch (error) {
    console.error('[career/engagements] Engagement created but welcome-back email was not queued:', error);
    return NextResponse.json({
      engagement,
      emailQueued: false,
      emailError: 'Engagement was saved, but the email could not be queued. You can edit the engagement and retry the email.',
    }, { status: 201 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    engagementId?: unknown;
    services?: unknown;
    resendEmail?: unknown;
  } | null;
  const engagementId = typeof body?.engagementId === 'string' ? body.engagementId : '';
  if (!engagementId) return NextResponse.json({ error: 'engagementId is required' }, { status: 400 });

  const engagement = await db.careerEngagement.findFirst({
    where: { id: engagementId, clientId: params.id },
  });
  if (!engagement) return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });

  const editingServices = Array.isArray(body?.services);
  const shouldSendEmail = editingServices || body?.resendEmail === true;
  if (!shouldSendEmail) return NextResponse.json({ error: 'Provide updated services or request an email resend' }, { status: 400 });

  const previousSendReplaced = await replacePendingEngagementEmails(params.id, engagement.id);
  if (!previousSendReplaced) {
    return NextResponse.json({ error: 'An email for this engagement is already sending. Wait for it to finish before editing or resending.' }, { status: 409 });
  }

  let updatedEngagement = engagement;
  if (editingServices) {
    const requestedSlugs = readRequestedSlugs(body?.services);
    if (requestedSlugs.length === 0) {
      return NextResponse.json({ error: 'Select at least one service for this engagement' }, { status: 400 });
    }

    const [otherEngagements, linkedServices] = await Promise.all([
      db.careerEngagement.findMany({
        where: { clientId: params.id, id: { not: engagement.id } },
        select: { previousServices: true, addedServices: true },
      }),
      db.careerClientService.findMany({
        where: { clientId: params.id },
        select: { serviceId: true, service: { select: { slug: true, name: true } } },
      }),
    ]);

    const oldAdded = readServiceSnapshot(engagement.addedServices);
    const oldAddedSlugs = new Set(oldAdded.map(service => service.slug));
    const protectedSlugs = new Set<string>([
      ...readServiceSnapshot(engagement.previousServices).map(service => service.slug),
      ...otherEngagements.flatMap(row => [
        ...readServiceSnapshot(row.previousServices).map(service => service.slug),
        ...readServiceSnapshot(row.addedServices).map(service => service.slug),
      ]),
      ...linkedServices
        .map(row => row.service.slug)
        .filter(slug => !oldAddedSlugs.has(slug)),
      ...requestedSlugs,
    ]);

    const supportedProtectedSlugs = [...protectedSlugs].filter((slug): slug is CareerServiceSlug =>
      VALID_SLUGS.has(slug as CareerServiceSlug),
    );
    const desiredServiceRecords = await resolveServices(supportedProtectedSlugs);
    const desiredSlugs = new Set(desiredServiceRecords.map(service => service.slug));
    const nextAddedServices = desiredServiceRecords
      .filter(service => requestedSlugs.includes(service.slug as CareerServiceSlug))
      .map(service => ({ slug: service.slug, name: service.name }));
    const removableServiceIds = linkedServices
      .filter(row => oldAddedSlugs.has(row.service.slug) && !desiredSlugs.has(row.service.slug))
      .map(row => row.serviceId);

    try {
      updatedEngagement = await db.$transaction(async tx => {
        const saved = await tx.careerEngagement.update({
          where: { id: engagement.id },
          data: { addedServices: nextAddedServices },
        });
        for (const service of desiredServiceRecords) {
          await tx.careerClientService.upsert({
            where: { clientId_serviceId: { clientId: params.id, serviceId: service.id } },
            create: { clientId: params.id, serviceId: service.id },
            update: {},
          });
        }
        if (removableServiceIds.length > 0) {
          await tx.careerClientService.deleteMany({
            where: { clientId: params.id, serviceId: { in: removableServiceIds } },
          });
        }
        await tx.careerActivityLog.create({
          data: {
            clientId: params.id,
            action: 'client_engagement_updated',
            performedBy: 'admin',
            metadata: { engagementId: engagement.id, sequence: engagement.sequence, addedServices: nextAddedServices },
          },
        });
        return saved;
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      console.error('[career/engagements] Failed to update engagement:', error);
      return NextResponse.json({ error: 'Could not update this engagement' }, { status: 500 });
    }
  }

  if (!shouldSendEmail) return NextResponse.json({ engagement: updatedEngagement, emailQueued: false });

  try {
    const emailQueueId = await queueEngagementEmail(params.id, updatedEngagement);
    return NextResponse.json({ engagement: updatedEngagement, emailQueued: true, emailQueueId });
  } catch (error) {
    console.error('[career/engagements] Could not queue email for saved engagement:', error);
    return NextResponse.json({
      engagement: updatedEngagement,
      emailQueued: false,
      emailError: 'Engagement changes were saved, but the email could not be queued. Try resending again.',
    });
  }
}
