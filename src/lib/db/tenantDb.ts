// src/lib/db/tenantDb.ts

import { prisma } from '@/lib/db';

/**
 * Returns a Prisma Client extension that automatically scopes queries and
 * mutations to the specified tenant brandId.
 *
 * If tenantId === 'SUPER_ADMIN', it bypasses the scoping (useful for global metrics).
 *
 * Models WITHOUT a brandId column (e.g. the Rn* tables, which are inherently
 * Ripple-Nexus-only) pass through unmodified.
 */
export function getTenantDb(tenantId: string) {
  if (tenantId === 'SUPER_ADMIN') {
    return prisma;
  }

  // Whitelist of models that have a `brandId` column shared across tenants.
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
        async findFirstOrThrow({ model, args, query }) {
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
        async aggregate({ model, args, query }) {
          if (TENANT_SCOPED_MODELS.includes(model)) {
            args.where = { ...(args as any).where, brandId: tenantId };
          }
          return query(args);
        },
        async create({ model, args, query }) {
          if (TENANT_SCOPED_MODELS.includes(model)) {
            args.data = { ...(args.data as any), brandId: tenantId };
          }
          return query(args);
        },
        async update({ model, args, query }) {
          if (TENANT_SCOPED_MODELS.includes(model)) {
            // `update` takes a unique where — verify ownership before mutating.
            const existing = await (prisma as any)[model.charAt(0).toLowerCase() + model.slice(1)]
              .findUnique({ where: args.where, select: { brandId: true } });
            if (!existing || existing.brandId !== tenantId) {
              throw new Error(`NotFoundError: No ${model} found for tenant`);
            }
          }
          return query(args);
        },
        async updateMany({ model, args, query }) {
          if (TENANT_SCOPED_MODELS.includes(model)) {
            args.where = { ...args.where, brandId: tenantId };
          }
          return query(args);
        },
        async delete({ model, args, query }) {
          if (TENANT_SCOPED_MODELS.includes(model)) {
            const existing = await (prisma as any)[model.charAt(0).toLowerCase() + model.slice(1)]
              .findUnique({ where: args.where, select: { brandId: true } });
            if (!existing || existing.brandId !== tenantId) {
              throw new Error(`NotFoundError: No ${model} found for tenant`);
            }
          }
          return query(args);
        },
        async deleteMany({ model, args, query }) {
          if (TENANT_SCOPED_MODELS.includes(model)) {
            args.where = { ...args.where, brandId: tenantId };
          }
          return query(args);
        },
      },
    },
  });
}
