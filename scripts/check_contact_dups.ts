import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const contacts = await prisma.contact.findMany({
    where: { email: { not: null } },
  });

  const emailCount: Record<string, number> = {};
  const duplicates: string[] = [];

  for (const contact of contacts) {
    if (!contact.email) continue;
    const email = contact.email.toLowerCase();
    emailCount[email] = (emailCount[email] || 0) + 1;
    if (emailCount[email] === 2) {
      duplicates.push(email);
    }
  }

  console.log('Duplicates found:', duplicates.length);
  if (duplicates.length > 0) {
    console.log('Duplicate emails:', duplicates);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
