// src/lib/storage/tenantCloudinary.ts
import { TenantContext } from '@/lib/auth/TenantContext';
import { getUploadSignature, getDeliveryUrl } from '@/lib/career/cloudinary';

/**
 * Returns the strictly isolated storage folder path for a given tenant.
 */
function getTenantFolder(tenantId: string, clientId: string): string {
  if (tenantId === 'ripple_nexus') {
    return `rn-deliverables/${clientId}`;
  } else if (tenantId === 'catalyst') {
    return `career-booster/${clientId}`;
  }
  throw new Error(`Unsupported tenant for storage: ${tenantId}`);
}

/**
 * Generates a tenant-safe upload signature.
 * Prevents an admin from uploading files into another tenant's directory.
 */
export async function getTenantUploadSignature(ctx: TenantContext, clientId: string) {
  const folder = getTenantFolder(ctx.tenantId, clientId);
  return getUploadSignature(folder);
}

/**
 * Generates a tenant-safe delivery URL (signed or public depending on MIME type).
 * Critically, it verifies that the requested file actually belongs to the active tenant.
 */
export async function getTenantDeliveryUrl(ctx: TenantContext, fileUrl: string, mimeType: string): Promise<string> {
  // Prevent cross-tenant file reads
  // If the admin is RN, they cannot generate delivery URLs for Catalyst folders.
  
  if (ctx.role !== 'SUPER_ADMIN') {
    if (ctx.tenantId === 'ripple_nexus' && fileUrl.includes('career-booster/')) {
      throw new Error('Forbidden: Attempted cross-tenant file access (Catalyst file requested by RN)');
    }
    if (ctx.tenantId === 'catalyst' && fileUrl.includes('rn-deliverables/')) {
      throw new Error('Forbidden: Attempted cross-tenant file access (RN file requested by Catalyst)');
    }
  }

  // If validation passes, delegate to the core cloudinary delivery system
  return getDeliveryUrl(fileUrl, mimeType);
}
