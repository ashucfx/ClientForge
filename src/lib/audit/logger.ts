// src/lib/audit/logger.ts
import { prisma } from '@/lib/db';
import { TenantContext } from '@/lib/auth/TenantContext';

export async function logAudit(
  ctx: TenantContext,
  action: string,
  entity: string,
  entityId: string,
  changes?: Record<string, any>
) {
  try {
    // We use any because the dev server might have locked the prisma client generation
    await (prisma as any).auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        adminId: ctx.adminId,
        action,
        entity,
        entityId,
        changes: changes ? JSON.stringify(changes) : null,
      }
    });
  } catch (error) {
    console.error('[AuditLog] Failed to write audit log:', error);
    // We do not throw here to prevent blocking the main business logic
  }
}
