import type { Prisma } from '@prisma/client';

function parseNumericSuffix(displayId: string | null | undefined): number | null {
  if (!displayId) return null;
  const parts = displayId.split('-');
  const value = parseInt(parts[parts.length - 1], 10);
  return Number.isFinite(value) ? value : null;
}

function isUniqueConstraintError(error: unknown, fieldName: string): boolean {
  if (!error || typeof error !== 'object') return false;
  const prismaError = error as { code?: string; meta?: { target?: unknown } };
  if (prismaError.code !== 'P2002') return false;
  const target = prismaError.meta?.target;
  if (!target) return false;
  return Array.isArray(target) ? target.includes(fieldName) : String(target).includes(fieldName);
}

export async function nextContactDisplayId(tx: Prisma.TransactionClient): Promise<string> {
  const latest = await tx.contact.findFirst({
    where: { displayId: { startsWith: 'LD-' } },
    orderBy: { displayId: 'desc' },
    select: { displayId: true },
  });
  const last = parseNumericSuffix(latest?.displayId) ?? 999;
  return `LD-${last + 1}`;
}

export async function nextInquiryDisplayId(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INQ-${year}-`;
  const latest = await tx.salesInquiry.findFirst({
    where: { displayId: { startsWith: prefix } },
    orderBy: { displayId: 'desc' },
    select: { displayId: true },
  });

  const last = latest?.displayId ? parseInt(latest.displayId.replace(prefix, ''), 10) : 0;
  const seq = Number.isFinite(last) && last > 0 ? last + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

export async function createWithGeneratedDisplayId<T>(
  fieldName: string,
  nextValue: () => Promise<string>,
  create: (displayId: string) => Promise<T>,
  maxRetries = 5
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const displayId = await nextValue();
    try {
      return await create(displayId);
    } catch (error) {
      if (!isUniqueConstraintError(error, fieldName)) throw error;
      lastError = error;
    }
  }

  throw lastError ?? new Error(`Unable to create unique ${fieldName}`);
}
