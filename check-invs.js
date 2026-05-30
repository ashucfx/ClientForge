const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.invoice.findMany({ where: { brandId: 'catalyst' } })
  .then(invs => console.log('Catalyst invoices:', invs.length))
  .finally(() => prisma.$disconnect());
