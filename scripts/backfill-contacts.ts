import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const isDryRun = process.argv.includes('--dry-run');
const BATCH_SIZE = 100;

interface DeduplicateResult {
  action: 'AUTO_LINK' | 'MANUAL_REVIEW' | 'CREATE_NEW';
  targetContactId?: string;
  confidenceScore?: number;
  reason?: string;
}

// Inlined scoring engine for standalone script to avoid alias issues
async function determineContactIdentity(tx: any, input: any): Promise<DeduplicateResult> {
  const orConditions: any[] = [];
  if (input.email) orConditions.push({ email: input.email });
  if (input.phone) orConditions.push({ phone: input.phone });
  if (input.name) orConditions.push({ name: input.name });

  if (orConditions.length === 0) return { action: 'CREATE_NEW' };

  const candidates = await tx.contact.findMany({
    where: { OR: orConditions, status: 'ACTIVE' }
  });

  if (candidates.length === 0) return { action: 'CREATE_NEW' };

  let bestMatch = null;
  let highestScore = 0;
  let bestReason = '';

  for (const candidate of candidates) {
    let score = 0;
    const matches = [];

    if (input.email && candidate.email && input.email.toLowerCase() === candidate.email.toLowerCase()) {
      score += 70;
      matches.push('Email');
    }
    if (input.phone && candidate.phone && input.phone.replace(/\D/g, '') === candidate.phone.replace(/\D/g, '')) {
      score += 25;
      matches.push('Phone');
    }
    if (input.name && candidate.name && input.name.toLowerCase().trim() === candidate.name.toLowerCase().trim()) {
      score += 5;
      matches.push('Name');
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = candidate;
      bestReason = `Matched on: ${matches.join(', ')}`;
    }
  }

  if (!bestMatch || highestScore < 30) return { action: 'CREATE_NEW' };
  if (highestScore >= 75) return { action: 'AUTO_LINK', targetContactId: bestMatch.id, confidenceScore: highestScore, reason: bestReason };
  
  return { action: 'MANUAL_REVIEW', targetContactId: bestMatch.id, confidenceScore: highestScore, reason: bestReason };
}

async function main() {
  console.log(`Starting backfill script... ${isDryRun ? '[DRY RUN]' : ''}`);

  const migrationId = `mig_${Date.now()}`;
  
  if (!isDryRun) {
    await prisma.migrationRun.create({
      data: {
        id: migrationId,
        type: 'CONTACT_BACKFILL',
        status: 'RUNNING',
        startedAt: new Date(),
      }
    });
  }

  let metrics = {
    recordsProcessed: 0,
    contactsCreated: 0,
    contactsMatched: 0,
    manualReviewsCreated: 0,
    errors: 0
  };

  try {
    // 1. Process Career Clients
    let hasMoreCareer = true;
    let careerCursor = undefined;
    
    while (hasMoreCareer) {
      const careerClients: any[] = await prisma.careerClient.findMany({
        take: BATCH_SIZE,
        skip: careerCursor ? 1 : 0,
        cursor: careerCursor ? { id: careerCursor } : undefined,
        where: { contactId: null },
        orderBy: { id: 'asc' }
      });

      if (careerClients.length === 0) {
        hasMoreCareer = false;
        break;
      }

      careerCursor = careerClients[careerClients.length - 1].id;
      
      console.log(`[CareerClient] Processing batch of ${careerClients.length}...`);

      for (const client of careerClients) {
        metrics.recordsProcessed++;
        
        try {
          await prisma.$transaction(async (tx) => {
            const dedup = await determineContactIdentity(tx, {
              email: client.email,
              phone: client.phone,
              name: client.name
            });

            let assignedContactId = null;

            if (dedup.action === 'AUTO_LINK' && dedup.targetContactId) {
              assignedContactId = dedup.targetContactId;
              metrics.contactsMatched++;
            } else if (dedup.action === 'CREATE_NEW') {
              if (!isDryRun) {
                const newContact = await tx.contact.create({
                  data: {
                    name: client.name,
                    email: client.email,
                    phone: client.phone,
                    contactSource: 'CATALYST',
                    status: 'ACTIVE'
                  }
                });
                assignedContactId = newContact.id;
              }
              metrics.contactsCreated++;
            } else if (dedup.action === 'MANUAL_REVIEW' && dedup.targetContactId) {
              if (!isDryRun) {
                const newContact = await tx.contact.create({
                  data: {
                    name: client.name,
                    email: client.email,
                    phone: client.phone,
                    contactSource: 'CATALYST',
                    status: 'ACTIVE'
                  }
                });
                assignedContactId = newContact.id;

                await tx.contactMergeReview.create({
                  data: {
                    sourceContactId: assignedContactId,
                    targetContactId: dedup.targetContactId,
                    confidenceScore: dedup.confidenceScore || 0,
                    reason: dedup.reason || 'Manual review required',
                    status: 'PENDING'
                  }
                });
              }
              metrics.manualReviewsCreated++;
            }

            if (!isDryRun && assignedContactId) {
              await tx.careerClient.update({
                where: { id: client.id },
                data: { contactId: assignedContactId }
              });
            }
          });
        } catch (err) {
          console.error(`Error processing CareerClient ${client.id}:`, err);
          metrics.errors++;
        }
      }
    }

    // 2. Process RN Clients
    let hasMoreRn = true;
    let rnCursor = undefined;
    
    while (hasMoreRn) {
      const rnClients: any[] = await prisma.rnClient.findMany({
        take: BATCH_SIZE,
        skip: rnCursor ? 1 : 0,
        cursor: rnCursor ? { id: rnCursor } : undefined,
        where: { contactId: null },
        orderBy: { id: 'asc' }
      });

      if (rnClients.length === 0) {
        hasMoreRn = false;
        break;
      }

      rnCursor = rnClients[rnClients.length - 1].id;
      
      console.log(`[RnClient] Processing batch of ${rnClients.length}...`);

      for (const client of rnClients) {
        metrics.recordsProcessed++;
        
        try {
          await prisma.$transaction(async (tx) => {
            const dedup = await determineContactIdentity(tx, {
              email: client.email,
              phone: client.phone,
              name: client.name
            });

            let assignedContactId = null;

            if (dedup.action === 'AUTO_LINK' && dedup.targetContactId) {
              assignedContactId = dedup.targetContactId;
              metrics.contactsMatched++;
            } else if (dedup.action === 'CREATE_NEW') {
              if (!isDryRun) {
                const newContact = await tx.contact.create({
                  data: {
                    name: client.name,
                    email: client.email,
                    phone: client.phone,
                    companyName: client.companyName,
                    country: client.country,
                    contactSource: 'RIPPLE_NEXUS',
                    status: 'ACTIVE'
                  }
                });
                assignedContactId = newContact.id;
              }
              metrics.contactsCreated++;
            } else if (dedup.action === 'MANUAL_REVIEW' && dedup.targetContactId) {
              if (!isDryRun) {
                const newContact = await tx.contact.create({
                  data: {
                    name: client.name,
                    email: client.email,
                    phone: client.phone,
                    contactSource: 'RIPPLE_NEXUS',
                    status: 'ACTIVE'
                  }
                });
                assignedContactId = newContact.id;

                await tx.contactMergeReview.create({
                  data: {
                    sourceContactId: assignedContactId,
                    targetContactId: dedup.targetContactId,
                    confidenceScore: dedup.confidenceScore || 0,
                    reason: dedup.reason || 'Manual review required',
                    status: 'PENDING'
                  }
                });
              }
              metrics.manualReviewsCreated++;
            }

            if (!isDryRun && assignedContactId) {
              await tx.rnClient.update({
                where: { id: client.id },
                data: { contactId: assignedContactId }
              });
            }
          });
        } catch (err) {
          console.error(`Error processing RnClient ${client.id}:`, err);
          metrics.errors++;
        }
      }
    }

    if (!isDryRun) {
      await prisma.migrationRun.update({
        where: { id: migrationId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          ...metrics
        }
      });
    }

    console.log(`Backfill completed successfully.`);
    console.log(`Metrics:`, metrics);

  } catch (globalErr) {
    console.error('Fatal error during backfill:', globalErr);
    if (!isDryRun) {
      await prisma.migrationRun.update({
        where: { id: migrationId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errors: metrics.errors + 1,
          metadata: { fatalError: String(globalErr) }
        }
      });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
