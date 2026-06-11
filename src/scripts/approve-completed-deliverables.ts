import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('Finding all COMPLETED career clients...');
  
  const completedCareerClients = await db.careerClient.findMany({
    where: { status: 'COMPLETED' },
    select: { id: true, name: true }
  });

  console.log(`Found ${completedCareerClients.length} COMPLETED career clients.`);

  let updatedCareer = 0;
  for (const client of completedCareerClients) {
    const res = await db.careerDeliverable.updateMany({
      where: { clientId: client.id, approvalStatus: 'PENDING' },
      data: { approvalStatus: 'APPROVED', approvedAt: new Date() }
    });
    if (res.count > 0) {
      console.log(`Updated ${res.count} deliverables for career client: ${client.name}`);
      updatedCareer += res.count;
    }
  }

  console.log('Finding all COMPLETED rn clients...');
  
  const completedRnClients = await db.rnClient.findMany({
    where: { currentStage: 'LAUNCHED' },
    select: { id: true, name: true }
  });

  console.log(`Found ${completedRnClients.length} COMPLETED rn clients.`);

  let updatedRn = 0;
  for (const client of completedRnClients) {
    const res = await db.rnDeliverable.updateMany({
      where: { clientId: client.id, approvalStatus: 'PENDING' },
      data: { approvalStatus: 'APPROVED', approvedAt: new Date() }
    });
    if (res.count > 0) {
      console.log(`Updated ${res.count} deliverables for rn client: ${client.name}`);
      updatedRn += res.count;
    }
  }

  console.log(`\nDONE. Auto-approved ${updatedCareer} career deliverables and ${updatedRn} rn deliverables.`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
