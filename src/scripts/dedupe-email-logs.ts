const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting CareerEmailLog deduplication...');
  
  // Find duplicates
  const duplicates = await prisma.careerEmailLog.groupBy({
    by: ['clientId', 'trigger'],
    having: {
      id: { _count: { gt: 1 } },
    },
  });

  console.log(`Found ${duplicates.length} duplicate groups.`);

  let deletedCount = 0;
  for (const group of duplicates) {
    const logs = await prisma.careerEmailLog.findMany({
      where: {
        clientId: group.clientId,
        trigger: group.trigger,
      },
      orderBy: { sentAt: 'asc' },
    });

    // Keep the first one, delete the rest
    const [keep, ...rest] = logs;
    const idsToDelete = rest.map((r: any) => r.id);

    if (idsToDelete.length > 0) {
      const res = await prisma.careerEmailLog.deleteMany({
        where: { id: { in: idsToDelete } },
      });
      deletedCount += res.count;
    }
  }

  console.log(`Successfully deleted ${deletedCount} duplicate records.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
