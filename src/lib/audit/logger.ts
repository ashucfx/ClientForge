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

// Enterprise Observability Wrapper for external monitoring tools (Datadog/LogSnag/Sentry)
export function logSystemError(
  context: 'PAYMENT' | 'WEBHOOK' | 'CRON' | 'QUEUE' | 'UPGRADE' | 'API_CRASH',
  message: string,
  error?: any,
  metadata?: Record<string, any>
) {
  const structuredLog = {
    timestamp: new Date().toISOString(),
    level: 'CRITICAL_FAILURE',
    context,
    message,
    metadata,
    error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error)
  };

  // This structured JSON output ensures Vercel log drains can correctly parse it
  // and pipe it into external Sentry/Datadog monitoring automatically.
  console.error(JSON.stringify(structuredLog));
}
