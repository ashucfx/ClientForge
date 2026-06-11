import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  try {
    await db.$executeRawUnsafe(`ALTER TABLE "ConversationReadState" ADD COLUMN "adminSlaDeadline" TIMESTAMP(3);`);
    console.log('Added adminSlaDeadline');
  } catch (e: any) {
    console.log('adminSlaDeadline error:', e.message);
  }
  
  try {
    await db.$executeRawUnsafe(`ALTER TABLE "ConversationReadState" ADD COLUMN "adminSlaEvent" TEXT;`);
    console.log('Added adminSlaEvent');
  } catch (e: any) {
    console.log('adminSlaEvent error:', e.message);
  }
}

main().catch(console.error).finally(() => db.$disconnect());
