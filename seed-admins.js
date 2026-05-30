const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

const util = require('util');
const scryptAsync = util.promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64);
  const hash = derivedKey.toString('hex');
  return salt + ':' + hash;
}

async function main() {
  await prisma.adminUser.upsert({
    where: { email: 'ashutosh.shukla@theripplenexus.com' },
    update: {
      passwordHash: await hashPassword('Rn_2026_Xk9$vQ!'),
      role: 'EDITOR',
      brandAccess: ['ripple_nexus'],
    },
    create: {
      email: 'ashutosh.shukla@theripplenexus.com',
      passwordHash: await hashPassword('Rn_2026_Xk9$vQ!'),
      role: 'EDITOR',
      brandAccess: ['ripple_nexus'],
    }
  });

  await prisma.adminUser.upsert({
    where: { email: 'catalyst@theripplenexus.com' },
    update: {
      passwordHash: await hashPassword('Cat_2026_Wm4#pZ!'),
      role: 'EDITOR',
      brandAccess: ['catalyst'],
    },
    create: {
      email: 'catalyst@theripplenexus.com',
      passwordHash: await hashPassword('Cat_2026_Wm4#pZ!'),
      role: 'EDITOR',
      brandAccess: ['catalyst'],
    }
  });
  console.log('Successfully created both separate admin accounts.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
