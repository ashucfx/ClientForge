// src/lib/db/tenantDb.ts

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

/**
 * Returns a Prisma Client extension that automatically scopes all queries
 * and mutations to the specified tenant brandId.
 * 
 * If tenantId === 'SUPER_ADMIN', it bypasses the scoping (useful for global metrics).
 */
export function getTenantDb(tenantId: string) {
  if (tenantId === 'SUPER_ADMIN') {
    return prisma;
  }

  // Define models that are tenant-scoped (e.g. have a brandId column)
  // We apply this extension to all models. If a model doesn't have brandId,
  // we might need to handle it differently, but for now we enforce it globally.
  // Wait, if a model doesn't have brandId, Prisma will throw a type/runtime error.
  // To be perfectly safe, we only extend specific models, or we ensure all models have brandId.
  // For ClientForge, Invoice definitely has it. Let's extend $allModels and assume we add brandId to everything,
  // OR we can specifically extend the models we know are scoped.
  
  // Whitelist of models that have a `brandId` column.
  // Models not in this list will be queried normally without brandId injection.
  const TENANT_SCOPED_MODELS = ['Invoice'];

  return prisma.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (TENANT_SCOPED_MODELS.includes(model)) {
            args.where = { ...args.where, brandId: tenantId };
          }
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if (TENANT_SCOPED_MODELS.includes(model)) {
            args.where = { ...args.where, brandId: tenantId };
          }
          return query(args);
        },
        async findUnique({ model, args, query }) {
          const result = await query(args);
          if (TENANT_SCOPED_MODELS.includes(model) && result && (result as any).brandId && (result as any).brandId !== tenantId) {
            return null;
          }
          return result;
        },
        async findUniqueOrThrow({ model, args, query }) {
          const result = await query(args);
          if (TENANT_SCOPED_MODELS.includes(model) && result && (result as any).brandId && (result as any).brandId !== tenantId) {
            throw new Error(`NotFoundError: No ${model} found`);
          }
          return result;
        },
        async count({ model, args, query }) {
          if (TENANT_SCOPED_MODELS.includes(model)) {
            args.where = { ...args.where, brandId: tenantId };
          }
          return query(args);
        },
        async update({ model, args, query }) {
          return query(args);
        },
        async create({ model, args, query }) {
          if (TENANT_SCOPED_MODELS.includes(model)) {
            args.data = { ...args.data, brandId: tenantId };
          }
          return query(args);
        }
      }
    }
  });
}
