import { prisma } from '../src/lib/db';
import { getExchangeRate } from '../src/lib/currency';

async function main() {
  console.log('Starting revenue recalculation for Flywheel profiles...');

  const profiles = await prisma.flywheelProfile.findMany({
    include: {
      contact: {
        include: {
          careerClients: true,
          rnClients: true
        }
      }
    }
  });

  console.log(`Found ${profiles.length} profiles to process.`);

  let updatedCount = 0;

  for (const profile of profiles) {
    if (!profile.contact) continue;

    // We will calculate total revenue based on CareerClients and RnClients
    // but the most robust source is the Invoice table for this email
    
    let totalFromClients = 0;

    // Career Clients
    for (const cc of profile.contact.careerClients) {
      if (cc.amountPaid > 0) {
        const rate = await getExchangeRate(cc.currency, 'INR');
        totalFromClients += (cc.amountPaid * rate);
      }
    }
    
    // RN Clients
    for (const rn of profile.contact.rnClients) {
      if (rn.amountPaid > 0) {
        const rate = await getExchangeRate(rn.currency, 'INR');
        totalFromClients += (rn.amountPaid * rate);
      }
    }

    // Now let's check Invoice table directly as source of truth
    let totalFromInvoices = 0;
    if (profile.contact.email) {
      const invoices = await prisma.invoice.findMany({
        where: { 
          clientEmail: profile.contact.email,
          status: 'PAID'
        }
      });
      
      for (const inv of invoices) {
        if (inv.totalPayable > 0 && inv.exchangeRate > 0) {
          totalFromInvoices += (inv.totalPayable * inv.exchangeRate);
        } else if (inv.totalPayable > 0) {
          const rate = await getExchangeRate(inv.currency, 'INR');
          totalFromInvoices += (inv.totalPayable * rate);
        }
      }
    }

    // Take the maximum of the two calculation methods
    const finalTotal = Math.max(totalFromClients, totalFromInvoices);

    const currentTotal = Number(profile.totalRevenue || 0);

    // If final total is greater or they differ by more than 1 INR
    if (finalTotal > 0 && Math.abs(currentTotal - finalTotal) > 1) {
      console.log(`[${profile.contact.email || profile.contact.name}] Updating revenue: ${currentTotal.toFixed(2)} -> ${finalTotal.toFixed(2)}`);
      await prisma.flywheelProfile.update({
        where: { id: profile.id },
        data: { totalRevenue: finalTotal }
      });
      updatedCount++;
    }
  }

  console.log(`Finished recalculation. Updated ${updatedCount} profiles.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
