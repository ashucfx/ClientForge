// src/lib/db.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Only log errors — 'query' logging in dev is noisy and slows down the pool
    log: ['error'],
    datasources: {
      db: {
        // Increase pool size to handle concurrent Next.js dev requests
        // connection_limit=10, pool_timeout=30 prevents exhaustion on hot reload
        url: process.env.DATABASE_URL
          ? process.env.DATABASE_URL.includes('?')
            ? `${process.env.DATABASE_URL}&connection_limit=10&pool_timeout=30`
            : `${process.env.DATABASE_URL}?connection_limit=10&pool_timeout=30`
          : process.env.DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
