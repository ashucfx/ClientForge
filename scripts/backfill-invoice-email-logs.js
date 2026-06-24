// One-time backfill: create sysEmailLog entries for invoices that were sent
// before logging was added to checkout/proposal/qualify flows.
//
// Usage: node scripts/backfill-invoice-email-logs.js
// Safe to run multiple times — skips invoices that already have a log entry.

const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  // 1. Collect all invoice IDs that already have a log entry
  const existingLogs = await db.sysEmailLog.findMany({
    where: { trigger: { in: ['INVOICE_SENT', 'INVOICE_RESENT'] } },
    select: { metadata: true, trigger: true },
  });

  const loggedIds = new Set(
    existingLogs
      .map(l => (l.metadata && typeof l.metadata === 'object' ? l.metadata.invoiceId : null))
      .filter(Boolean)
  );

  console.log(`Existing invoice email logs: ${existingLogs.length} (covering ${loggedIds.size} unique invoices)`);

  // 2. Build a set of (invoiceId:trigger) pairs already logged to avoid exact duplicates
  const loggedPairs = new Set(
    existingLogs.map(l => {
      const id = l.metadata && typeof l.metadata === 'object' ? l.metadata.invoiceId : null;
      return id ? `${id}:${l.trigger}` : null;
    }).filter(Boolean)
  );

  // 3. Fetch all invoices where an email was sent
  const invoices = await db.invoice.findMany({
    where: { emailSentAt: { not: null } },
    select: {
      id: true,
      invoiceNumber: true,
      clientEmail: true,
      totalPayable: true,
      currency: true,
      emailSentAt: true,
      emailResendCount: true,
    },
    orderBy: { emailSentAt: 'asc' },
  });

  console.log(`Invoices with emailSentAt set: ${invoices.length}`);

  // Build list of entries to create
  const toCreate = [];
  for (const inv of invoices) {
    // Original send
    if (!loggedPairs.has(`${inv.id}:INVOICE_SENT`)) {
      toCreate.push({ inv, trigger: 'INVOICE_SENT', sentAt: inv.emailSentAt });
    }
    // Resends — we don't have exact timestamps, so space them 1min after original
    if (inv.emailResendCount > 0 && !loggedPairs.has(`${inv.id}:INVOICE_RESENT`)) {
      for (let i = 0; i < inv.emailResendCount; i++) {
        const sentAt = new Date(inv.emailSentAt.getTime() + (i + 1) * 60_000);
        toCreate.push({ inv, trigger: 'INVOICE_RESENT', sentAt });
      }
    }
  }

  console.log(`Entries to create: ${toCreate.length}\n`);

  if (toCreate.length === 0) {
    console.log('Nothing to backfill. All invoice emails are already logged.');
    return;
  }

  let created = 0;
  let failed = 0;

  for (const { inv, trigger, sentAt } of toCreate) {
    try {
      await db.sysEmailLog.create({
        data: {
          to: inv.clientEmail,
          subject: `Invoice ${inv.invoiceNumber}${trigger === 'INVOICE_RESENT' ? ' (resend)' : ''}`,
          trigger,
          channel: 'resend',
          status: 'sent',
          sentAt,
          metadata: {
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            amount: inv.totalPayable,
            currency: inv.currency,
            source: 'backfill',
          },
        },
      });
      created++;
      const tag = trigger === 'INVOICE_RESENT' ? '↩ resend' : '  send ';
      console.log(`  ✓ [${tag}] ${inv.invoiceNumber.padEnd(20)} ${inv.clientEmail.padEnd(36)} ${sentAt.toISOString().replace('T', ' ').slice(0, 16)}`);
    } catch (err) {
      failed++;
      console.error(`  ✗ ${inv.invoiceNumber} (${trigger}) — ${err.message}`);
    }
  }

  console.log(`\nDone. Created: ${created}  Failed: ${failed}`);
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => db.$disconnect());
