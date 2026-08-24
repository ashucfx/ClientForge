// src/lib/systemSettings.ts
// Server-only helper — never import on the client side.
// Provides typed get/set wrappers around the SystemSetting table.

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

// ─── Known setting keys & their default values ───────────────────────────────

export type SettingKey =
  | 'GLOBAL_CURRENCY_PRICING'
  | 'EXECUTIVE_CONNECT_PRICING'
  | 'GLOBAL_PRICING_V2';

export type GlobalCurrencyPricingMap = {
  [currency: string]: {
    RESUME: Record<string, number>;
    LINKEDIN: Record<string, number>;
    COVER_LETTER: Record<string, number>;
    PORTFOLIO: Record<string, number>;
  };
};

const DEFAULTS: Record<SettingKey, unknown> = {
  GLOBAL_CURRENCY_PRICING: {}, // Defaults to empty map, logic falls back to USD API
  GLOBAL_PRICING_V2: null, // we will handle fallback in pricing-v2.ts
  EXECUTIVE_CONNECT_PRICING: {
    INR: 4999,
    USD: 100,
    EUR: 90,
    GBP: 80,
    AUD: 150,
    CAD: 140,
    AED: 367,
    SGD: 135
  }
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

export async function getGlobalCurrencyPricing(): Promise<GlobalCurrencyPricingMap> {
  return getSetting<GlobalCurrencyPricingMap>('GLOBAL_CURRENCY_PRICING');
}

export async function getExecutiveConnectPricingMap(): Promise<Record<string, number>> {
  return getSetting<Record<string, number>>('EXECUTIVE_CONNECT_PRICING');
}
