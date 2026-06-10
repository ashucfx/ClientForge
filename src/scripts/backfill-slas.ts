import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  const clients = await db.careerClient.findMany({
    where: { 
      expectedDeliveryAt: null,
      forms: { some: {} }
    },
    include: { forms: { orderBy: { submittedAt: 'asc' }, take: 1 } }
  });

  console.log('Found ' + clients.length + ' clients missing SLA');

  for (const client of clients) {
    if (client.forms.length > 0) {
      const earliest = client.forms[0].submittedAt;
      const d = new Date(earliest);
      let added = 0;
      while (added < 5) {
        d.setDate(d.getDate() + 1);
        if (d.getDay() !== 0 && d.getDay() !== 6) added++;
      }
      
      await db.careerClient.update({
        where: { id: client.id },
        data: { expectedDeliveryAt: d }
      });
      
      console.log('Updated ' + client.email + ' SLA to ' + d.toISOString());
    } else {
      console.log('Client ' + client.email + ' has no forms submitted yet, skipping SLA.');
    }
  }
}

main().catch(console.error).finally(() => db.$disconnect());
