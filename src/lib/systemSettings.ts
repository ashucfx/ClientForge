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
export async function getSetting<T = unknown>(key: SettingKey): Promise<T> {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key } });
    if (row === null) return DEFAULTS[key] as T;
    return row.value as T;
  } catch {
    // Graceful degradation: return default if the table doesn't exist yet
    return DEFAULTS[key] as T;
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
  key: SettingKey,
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

export async function isPremiumPlusEnabled(): Promise<boolean> {
  return getSetting<boolean>('PREMIUM_PLUS_ENABLED');
}

export async function getPremiumPlusPrice(currency: 'INR' | 'USD'): Promise<number> {
  const key: SettingKey = currency === 'INR' ? 'PREMIUM_PLUS_PRICE_INR' : 'PREMIUM_PLUS_PRICE_USD';
  return getSetting<number>(key);
}
