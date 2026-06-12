import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting backfill script...');

  // 1. Backfill Career Clients
  console.log('Backfilling CareerClients...');
  const careerClients = await prisma.careerClient.findMany({
    where: { contactId: null }
  });

  for (const client of careerClients) {
    // Check if a Contact with this email already exists
    let contact = await prisma.contact.findFirst({
      where: { email: client.email }
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          name: client.name,
          email: client.email,
          phone: client.phone,
          contactSource: 'CATALYST'
        }
      });
    }

    await prisma.careerClient.update({
      where: { id: client.id },
      data: { contactId: contact.id }
    });
  }
  console.log(`Updated ${careerClients.length} CareerClients.`);

  // 2. Backfill RN Clients
  console.log('Backfilling RnClients...');
  const rnClients = await prisma.rnClient.findMany({
    where: { contactId: null }
  });

  for (const client of rnClients) {
    let contact = await prisma.contact.findFirst({
      where: { email: client.email }
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          name: client.name,
          email: client.email,
          phone: client.phone,
          companyName: client.companyName,
          country: client.country,
          contactSource: 'RIPPLE_NEXUS'
        }
      });
    }

    await prisma.rnClient.update({
      where: { id: client.id },
      data: { contactId: contact.id }
    });
  }
  console.log(`Updated ${rnClients.length} RnClients.`);

  // 3. Populate Flywheel Metrics from Invoices
  console.log('Populating Flywheel Metrics...');
  const invoices = await prisma.invoice.findMany({
    where: { status: 'PAID' }
  });

  for (const invoice of invoices) {
    const brandId = invoice.brandId || 'catalyst';
    const amount = invoice.totalPayable || 0;
    const date = invoice.paidAt || invoice.createdAt;
    
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);
    normalizedDate.setDate(1);

    await prisma.flywheelRevenueMetrics.upsert({
      where: {
        date_brandId: {
          date: normalizedDate,
          brandId
        }
      },
      update: {
        totalCollected: { increment: amount },
        oneTimeRevenue: { increment: amount }
      },
      create: {
        date: normalizedDate,
        brandId,
        totalCollected: amount,
        oneTimeRevenue: amount
      }
    });

    // Also link invoice to contact profile via email if possible
    const contact = await prisma.contact.findFirst({
      where: { email: invoice.clientEmail }
    });

    if (contact) {
      await prisma.flywheelProfile.upsert({
        where: { contactId: contact.id },
        update: {
          totalRevenue: { increment: amount },
          invoiceCount: { increment: 1 },
          lastInvoiceDate: date,
          leadStatus: 'QUALIFIED',
          lifecycleStage: 'CUSTOMER'
        },
        create: {
          contactId: contact.id,
          totalRevenue: amount,
          invoiceCount: 1,
          lastInvoiceDate: date,
          leadStatus: 'QUALIFIED',
          lifecycleStage: 'CUSTOMER'
        }
      });
    }
  }
  console.log(`Processed ${invoices.length} Paid Invoices for metrics.`);

  console.log('Backfill completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
