// src/lib/db.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getDatabaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.NEON_DATABASE_URL ??
    undefined
  );
}

function withPoolParams(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has('connection_limit')) u.searchParams.set('connection_limit', '10');
    if (!u.searchParams.has('pool_timeout')) u.searchParams.set('pool_timeout', '30');
    return u.toString();
  } catch {
    // Fallback to the previous safe string concatenation approach.
    return url.includes('?')
      ? `${url}&connection_limit=10&pool_timeout=30`
      : `${url}?connection_limit=10&pool_timeout=30`;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Only log errors — 'query' logging in dev is noisy and slows down the pool
    log: ['error'],
    datasources: {
      db: {
        // Increase pool size to handle concurrent Next.js dev requests
        // connection_limit=10, pool_timeout=30 prevents exhaustion on hot reload
        url: withPoolParams(getDatabaseUrl()),
      },
    },
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
