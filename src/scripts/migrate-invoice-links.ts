// src/scripts/migrate-invoice-links.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration backfill for InvoiceClientLink...');

  const clients = await prisma.careerClient.findMany({
    where: {
      invoiceId: { not: null }
    },
    select: {
      id: true,
      invoiceId: true
    }
  });

  console.log(`Found ${clients.length} clients with legacy invoiceId.`);

  let createdCount = 0;
  let errorCount = 0;

  for (const client of clients) {
    if (!client.invoiceId) continue;

    try {
      await prisma.invoiceClientLink.upsert({
        where: {
          clientId_invoiceId: {
            clientId: client.id,
            invoiceId: client.invoiceId
          }
        },
        create: {
          clientId: client.id,
          invoiceId: client.invoiceId,
          purpose: 'INITIAL'
        },
        update: {} // Idempotent
      });
      createdCount++;
    } catch (e) {
      console.error(`Failed to migrate client ${client.id} invoice ${client.invoiceId}:`, e);
      errorCount++;
    }
  }

  console.log(`Migration complete. Upserted ${createdCount} links. Errors: ${errorCount}.`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
