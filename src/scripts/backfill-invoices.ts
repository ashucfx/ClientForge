// src/scripts/backfill-invoices.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting backfill for invoices (JSON -> Relational)');
  
  const invoices = await prisma.invoice.findMany({
    select: {
      id: true,
      lineItems: true,
      installments: true,
    }
  });

  console.log(`Found ${invoices.length} invoices to process.`);
  
  for (const invoice of invoices) {
    const lineItems = invoice.lineItems as any[] || [];
    const installments = invoice.installments as any[] || [];
    
    // Check if line items already exist to make it idempotent
    const existingLineItems = await prisma.invoiceLineItem.count({
      where: { invoiceId: invoice.id }
    });
    
    if (existingLineItems === 0 && lineItems.length > 0) {
      await prisma.invoiceLineItem.createMany({
        data: lineItems.map((item: any) => ({
          invoiceId: invoice.id,
          description: item.description || 'Legacy Item',
          qty: item.qty || 1,
          unitPrice: item.unitPrice || 0,
          lineTotal: item.lineTotal || 0,
        }))
      });
      console.log(`[Invoice ${invoice.id}] Backfilled ${lineItems.length} line items.`);
    }

    const existingInstallments = await prisma.invoiceInstallment.count({
      where: { invoiceId: invoice.id }
    });
    
    if (existingInstallments === 0 && installments.length > 0) {
      await prisma.invoiceInstallment.createMany({
        data: installments.map((inst: any) => ({
          invoiceId: invoice.id,
          seq: inst.seq || 1,
          amount: inst.amount || 0,
          dueDate: inst.dueDate ? new Date(inst.dueDate) : new Date(),
          status: inst.status || 'PENDING',
        }))
      });
      console.log(`[Invoice ${invoice.id}] Backfilled ${installments.length} installments.`);
    }
  }

  console.log('Backfill complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
