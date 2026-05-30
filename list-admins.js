const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.adminUser.findMany()
  .then(console.log)
  .finally(() => prisma.$disconnect());
