const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const ci = await prisma.invoice.count({ where: { brandId: 'catalyst' } });
  const ri = await prisma.invoice.count({ where: { brandId: 'ripple_nexus' } });
  const otherInvoices = await prisma.invoice.count({ where: { brandId: { notIn: ['catalyst', 'ripple_nexus'] } } });
  const totalInvoices = await prisma.invoice.count();
  
  const rnc = await prisma.rnClient.count();
  const cc = await prisma.careerClient.count();
  const totalContacts = await prisma.contact.count();
  const rnContactsOnly = await prisma.contact.count({ where: { rnClients: { some: {} }, careerClients: { none: {} } } });
  const bothContacts = await prisma.contact.count({ where: { rnClients: { some: {} }, careerClients: { some: {} } } });

  const rno = await prisma.rnOrganization.count();
  const rnom = await prisma.rnOrganizationMember.count();
  const rnsm = await prisma.rnServiceModule.count();
  const rnh = await prisma.rnHoliday.count();
  const rnet = await prisma.rnEmailTemplate.count();
  const rnn = await prisma.notification.count({ where: { brandId: 'ripple_nexus' } });
  const fp = await prisma.flywheelProfile.count();

  const admins = await prisma.adminUser.findMany({
    select: { id: true, email: true, role: true, brandAccess: true }
  });

  console.log('=== DATABASE AUDIT ===');
  console.log('Catalyst Invoices (PROTECT):', ci);
  console.log('RN Invoices:', ri);
  console.log('Other Invoices:', otherInvoices);
  console.log('Total Invoices:', totalInvoices);
  console.log('Career Clients (PROTECT):', cc);
  console.log('Total Contacts:', totalContacts);
  console.log('RN Clients:', rnc);
  console.log('Contacts RN-only:', rnContactsOnly);
  console.log('Contacts Both Brands:', bothContacts);
  console.log('RnOrganization:', rno);
  console.log('RnOrganizationMember:', rnom);
  console.log('RnServiceModule:', rnsm);
  console.log('RnHoliday:', rnh);
  console.log('RnEmailTemplate:', rnet);
  console.log('RN Notifications:', rnn);
  console.log('FlywheelProfile:', fp);
  console.log('Admins count:', admins.length);
  admins.forEach(a => {
    console.log(` - Admin: ${a.email} (${a.role}) | brandAccess: ${JSON.stringify(a.brandAccess)}`);
  });
}

main()
  .catch(e => {
    console.error('Audit failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
