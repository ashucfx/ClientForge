// src/lib/systemSettings.ts
// Server-only helper — never import on the client side.
// Provides typed get/set wrappers around the SystemSetting table.

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

// ─── Known setting keys & their default values ───────────────────────────────

export type SettingKey =
  | 'PREMIUM_PLUS_ENABLED'
  | 'PREMIUM_PLUS_PRICE_INR'
  | 'PREMIUM_PLUS_PRICE_USD';

const DEFAULTS: Record<SettingKey, unknown> = {
  PREMIUM_PLUS_ENABLED:   false,
  PREMIUM_PLUS_PRICE_INR: 4999,
  PREMIUM_PLUS_PRICE_USD: 59,
};

// ─── Generic helpers ─────────────────────────────────────────────────────────

/**
 * Read a setting value. Returns the stored value or the hardcoded default if
 * the row does not yet exist.
 */
export async function getSetting<T = unknown>(key: string): Promise<T> {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key } });
    if (row === null) return (DEFAULTS as Record<string, unknown>)[key] as T;
    return row.value as T;
  } catch {
    // Graceful degradation: return default if the table doesn't exist yet
    return (DEFAULTS as Record<string, unknown>)[key] as T;
  }
}

/**
 * Read multiple settings in a single DB round-trip.
 */
export async function getSettings(
  keys: SettingKey[]
): Promise<Record<string, unknown>> {
  try {
    const rows = await prisma.systemSetting.findMany({ where: { key: { in: keys } } });
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      const row = rows.find((r: (typeof rows)[number]) => r.key === key);
      result[key] = row ? row.value : DEFAULTS[key];
    }
    return result;
  } catch {
    const result: Record<string, unknown> = {};
    for (const key of keys) result[key] = DEFAULTS[key];
    return result;
  }
}

/**
 * Upsert a setting value. Optionally record which admin changed it.
 */
export async function setSetting(
  key: string,
  value: unknown,
  updatedBy?: string
): Promise<void> {
  const jsonVal = value as Prisma.InputJsonValue;
  await prisma.systemSetting.upsert({
    where:  { key },
    create: { key, value: jsonVal, updatedBy },
    update: { value: jsonVal, updatedBy },
  });
}

// ─── Convenience typed helpers ────────────────────────────────────────────────

export async function isPremiumPlusEnabled(clientId?: string): Promise<boolean> {
  if (clientId) {
    try {
      const enabledKey = `CLIENT_UPGRADE_ENABLED_${clientId}`;
      const inrKey = `CLIENT_PRICE_${clientId}_INR`;
      const usdKey = `CLIENT_PRICE_${clientId}_USD`;
      const rows = await prisma.systemSetting.findMany({
        where: { key: { in: [enabledKey, inrKey, usdKey] } },
      });
      const enabledRow = rows.find((r: (typeof rows)[number]) => r.key === enabledKey);
      if (enabledRow !== undefined) {
        return Boolean(enabledRow.value);
      }
      const inrRow = rows.find((r: (typeof rows)[number]) => r.key === inrKey);
      const usdRow = rows.find((r: (typeof rows)[number]) => r.key === usdKey);
      if ((inrRow && typeof inrRow.value === 'number' && inrRow.value > 0) || (usdRow && typeof usdRow.value === 'number' && usdRow.value > 0)) {
        return true;
      }
    } catch { /* fallback to global */ }
  }
  return getSetting<boolean>('PREMIUM_PLUS_ENABLED');
}

export async function getPremiumPlusPrice(currency: 'INR' | 'USD', clientId?: string): Promise<number> {
  if (clientId) {
    try {
      const clientKey = `CLIENT_PRICE_${clientId}_${currency}`;
      const row = await prisma.systemSetting.findUnique({ where: { key: clientKey } });
      if (row !== null && typeof row.value === 'number' && row.value > 0) {
        return row.value;
      }
    } catch { /* fallback to global */ }
  }
  const key: SettingKey = currency === 'INR' ? 'PREMIUM_PLUS_PRICE_INR' : 'PREMIUM_PLUS_PRICE_USD';
  return getSetting<number>(key);
}

export async function setClientPriceOverride(
  clientId: string,
  currency: 'INR' | 'USD',
  price: number,
  updatedBy?: string
): Promise<void> {
  const key = `CLIENT_PRICE_${clientId}_${currency}`;
  const jsonVal = price as Prisma.InputJsonValue;
  await prisma.systemSetting.upsert({
    where:  { key },
    create: { key, value: jsonVal, updatedBy },
    update: { value: jsonVal, updatedBy },
  });
}
