const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.adminUser.findUnique({ where: { email: 'catalyst@theripplenexus.com' } })
  .then(console.log)
  .finally(() => prisma.$disconnect());
