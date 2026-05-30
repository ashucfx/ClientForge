const fs = require('fs');
const envText = fs.readFileSync('.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const match = line.match(/^([^#\s]+)=(.*)$/);
  if (match) env[match[1]] = match[2];
});

Object.assign(process.env, env);

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

const salt = process.env.ADMIN_SESSION_SECRET;
const email = process.env.ADMIN_NOTIFY_EMAIL || 'admin@example.com';
const rawPassword = process.env.ADMIN_PASSWORD;

if (!salt || !rawPassword) {
  console.error("Missing ADMIN_SESSION_SECRET or ADMIN_PASSWORD in .env.local");
  process.exit(1);
}

const util = require('util');
const scryptAsync = util.promisify(crypto.scrypt);

async function main() {
  const newSalt = crypto.randomBytes(16).toString('hex');
  const scryptHashBuffer = await scryptAsync(rawPassword, newSalt, 64);
  const passwordHash = `${newSalt}:${scryptHashBuffer.toString('hex')}`;
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user ${email} already exists. Updating password...`);
    await prisma.adminUser.update({
      where: { email },
      data: { passwordHash, role: 'SUPER_ADMIN', isActive: true }
    });
    console.log("Updated successfully!");
  } else {
    console.log(`Creating Admin user ${email}...`);
    await prisma.adminUser.create({
      data: {
        email,
        passwordHash,
        role: 'SUPER_ADMIN',
        isActive: true
      }
    });
    console.log("Created successfully!");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
