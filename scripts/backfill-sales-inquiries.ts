/**
 * Backfill SalesInquiry records from legacy FlywheelProfile.metadata.applicationRequest
 *
 * Usage:
 *   npx tsx scripts/backfill-sales-inquiries.ts           # dry-run (default)
 *   npx tsx scripts/backfill-sales-inquiries.ts --execute # write to DB
 */

import { PrismaClient, InquiryStatus } from '@prisma/client';

const db = new PrismaClient();
const EXECUTE = process.argv.includes('--execute');

function mapLegacyLeadStatus(leadStatus?: string | null): InquiryStatus {
  switch (leadStatus) {
    case 'QUALIFIED':
    case 'IN_PROGRESS':
      return 'QUALIFIED';
    case 'UNQUALIFIED':
      return 'REJECTED';
    case 'OPEN':
    case 'CONTACTED':
      return 'UNDER_REVIEW';
    default:
      return 'NEW';
  }
}

async function nextInquiryDisplayId(year: number, seq: number): Promise<string> {
  return `INQ-${year}-${String(seq).padStart(4, '0')}`;
}

async function main() {
  console.log(EXECUTE ? 'EXECUTE mode' : 'DRY-RUN mode (pass --execute to write)');

  const profiles = await db.flywheelProfile.findMany({
    include: { contact: true },
  });

  let candidates = 0;
  let skipped = 0;
  let created = 0;
  let seq = 1;
  const year = new Date().getFullYear();

  const existingCount = await db.salesInquiry.count({
    where: { displayId: { startsWith: `INQ-${year}-` } },
  });
  seq = existingCount + 1;

  for (const profile of profiles) {
    const meta = profile.metadata as Record<string, unknown> | null;
    const appReq = meta?.applicationRequest as Record<string, unknown> | undefined;
    if (!appReq) continue;

    candidates++;

    const contact = profile.contact;
    if (!contact?.email) {
      skipped++;
      continue;
    }

    const existing = await db.salesInquiry.findFirst({
      where: {
        OR: [{ contactId: contact.id }, { email: { equals: contact.email, mode: 'insensitive' } }],
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    const displayId = await nextInquiryDisplayId(year, seq++);
    const status = mapLegacyLeadStatus(profile.leadStatus);

    const payload = {
      displayId,
      contactId: contact.id,
      flywheelProfileId: profile.id,
      channel: 'INQUIRE' as const,
      status,
      name: contact.name,
      email: contact.email.toLowerCase(),
      phone: contact.phone,
      countryCode: (appReq.countryCode as string) || contact.country || 'IN',
      countryName: 'Unknown',
      requirementType: 'OTHER',
      servicesRequested: (appReq.services as string[]) || [],
      legacyMetadata: { applicationRequest: appReq } as object,
    };

    console.log(`[${EXECUTE ? 'CREATE' : 'WOULD CREATE'}] ${displayId} — ${contact.email} (${status})`);

    if (EXECUTE) {
      const inquiry = await db.salesInquiry.create({ data: payload });
      await db.inquiryActivityLog.create({
        data: {
          inquiryId: inquiry.id,
          action: 'BACKFILL',
          note: 'Migrated from FlywheelProfile.metadata.applicationRequest',
          toStatus: status,
        },
      });
      created++;
    }
  }

  console.log('\nSummary:');
  console.log(`  Candidates with applicationRequest: ${candidates}`);
  console.log(`  Skipped (existing or no email): ${skipped}`);
  console.log(`  ${EXECUTE ? 'Created' : 'Would create'}: ${EXECUTE ? created : candidates - skipped}`);

  if (!EXECUTE) {
    await db.$disconnect();
    return;
  }

  await db.migrationRun.upsert({
    where: { id: 'backfill-sales-inquiries-v1' },
    create: {
      id: 'backfill-sales-inquiries-v1',
      type: 'BACKFILL_SALES_INQUIRIES',
      status: 'COMPLETED',
      startedAt: new Date(),
      completedAt: new Date(),
      recordsProcessed: candidates,
      contactsMatched: created,
    },
    update: {
      status: 'COMPLETED',
      completedAt: new Date(),
      recordsProcessed: candidates,
      contactsMatched: created,
    },
  });

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
