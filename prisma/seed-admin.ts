// prisma/seed-admin.ts
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// This is a simple hash mechanism for passwords since we removed bcrypt for edge compatibility.
// In a full production setup, use `scrypt` or a similar standard.
// We use a salt and sha256 to hash the password here for simplicity in the seed.
export function hashPassword(password: string, salt: string): string {
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

async function main() {
  const email = 'catalyst@theripplenexus.com'; // Default admin email
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
  const salt = process.env.ADMIN_SESSION_SECRET || 'default-salt';
  
  const passwordHash = hashPassword(password, salt);

  console.log(`Ensuring SUPER_ADMIN user exists for: ${email}`);

  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: {
      passwordHash,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
    create: {
      email,
      passwordHash,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  console.log('✅ Admin user ready:', admin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
