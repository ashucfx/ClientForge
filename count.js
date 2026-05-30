const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.invoice.groupBy({ by: ['brandId'], _count: true })
  .then(console.log)
  .finally(() => prisma.$disconnect());
