const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- PHASE 2: DATABASE DATA CLEANUP ---');

  // Safety Pre-check
  const preCatalystInvoices = await prisma.invoice.count({ where: { brandId: 'catalyst' } });
  const preCareerClients = await prisma.careerClient.count();
  console.log(`Pre-check: Catalyst Invoices = ${preCatalystInvoices}, Career Clients = ${preCareerClients}`);

  // 1. Delete RnClient child records & RnClient
  const rnClients = await prisma.rnClient.findMany({ select: { id: true } });
  const rnClientIds = rnClients.map(c => c.id);
  console.log(`Found ${rnClientIds.length} RnClient(s):`, rnClientIds);

  if (rnClientIds.length > 0) {
    // Delete RnClient deliverables, checkins, notes, etc.
    const delNotes = await prisma.adminNote.deleteMany({ where: { clientId: { in: rnClientIds } } });
    console.log(`Deleted AdminNotes for RN clients: ${delNotes.count}`);

    const delDeliverables = await prisma.rnDeliverable.deleteMany({ where: { clientId: { in: rnClientIds } } });
    console.log(`Deleted RnDeliverables: ${delDeliverables.count}`);

    const delClients = await prisma.rnClient.deleteMany({ where: { id: { in: rnClientIds } } });
    console.log(`Deleted RnClients: ${delClients.count}`);
  }

  // 2. Delete RN organizational & auxiliary models
  const delOrgMembers = await prisma.rnOrganizationMember.deleteMany({});
  console.log(`Deleted RnOrganizationMembers: ${delOrgMembers.count}`);

  const delOrgs = await prisma.rnOrganization.deleteMany({});
  console.log(`Deleted RnOrganizations: ${delOrgs.count}`);

  const delModules = await prisma.rnServiceModule.deleteMany({});
  console.log(`Deleted RnServiceModules: ${delModules.count}`);

  const delHolidays = await prisma.rnHoliday.deleteMany({});
  console.log(`Deleted RnHolidays: ${delHolidays.count}`);

  const delTemplates = await prisma.rnEmailTemplate.deleteMany({});
  console.log(`Deleted RnEmailTemplates: ${delTemplates.count}`);

  // 3. Delete RN-specific notifications & RN-only invoices (if any)
  const delNotifications = await prisma.notification.deleteMany({ where: { brandId: 'ripple_nexus' } });
  console.log(`Deleted RN notifications: ${delNotifications.count}`);

  const delRnInvoices = await prisma.invoice.deleteMany({ where: { brandId: 'ripple_nexus' } });
  console.log(`Deleted RN invoices: ${delRnInvoices.count}`);

  // 4. Update AdminUser brandAccess - migrate all to ["catalyst"]
  const admins = await prisma.adminUser.findMany();
  for (const admin of admins) {
    const updatedAccess = ['catalyst'];
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { brandAccess: updatedAccess },
    });
    console.log(`Updated admin ${admin.email}: brandAccess -> ${JSON.stringify(updatedAccess)}`);
  }

  // Safety Post-check
  const postCatalystInvoices = await prisma.invoice.count({ where: { brandId: 'catalyst' } });
  const postCareerClients = await prisma.careerClient.count();
  console.log(`Post-check: Catalyst Invoices = ${postCatalystInvoices}, Career Clients = ${postCareerClients}`);

  if (postCatalystInvoices !== preCatalystInvoices || postCareerClients !== preCareerClients) {
    throw new Error('CRITICAL SAFETY ASSERTION FAILED: Catalyst data discrepancy detected!');
  }

  console.log('--- CLEANUP COMPLETE: Zero Catalyst records affected. ---');
}

main()
  .catch(e => {
    console.error('Migration execution failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
