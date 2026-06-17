// src/lib/referral.ts
// Referral code generation and tracking utilities.

import { prisma as db } from '@/lib/db';
import crypto from 'crypto';

const CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I)
const CODE_LENGTH = 8;

function generateCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  return Array.from(bytes, (b) => CODE_CHARSET[b % CODE_CHARSET.length]).join('');
}

/**
 * Returns an existing referral code for a FlywheelProfile, or generates and
 * persists a new unique one. Safe to call concurrently — retries on collision.
 */
export async function ensureReferralCode(flywheelProfileId: string): Promise<string> {
  const existing = await db.flywheelProfile.findUnique({
    where: { id: flywheelProfileId },
    select: { referralCode: true },
  });
  if (existing?.referralCode) return existing.referralCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      const updated = await db.flywheelProfile.update({
        where: { id: flywheelProfileId },
        data: { referralCode: code },
        select: { referralCode: true },
      });
      return updated.referralCode!;
    } catch (err: any) {
      // P2002 = unique constraint violation (code collision)
      if (err.code === 'P2002') continue;
      throw err;
    }
  }
  throw new Error('Failed to generate unique referral code after 5 attempts');
}

/**
 * Looks up the FlywheelProfile that owns a given referral code.
 * Returns null if not found.
 */
export async function findReferrerByCode(code: string) {
  return db.flywheelProfile.findUnique({
    where: { referralCode: code.toUpperCase() },
    select: { id: true, contactId: true, contact: { select: { name: true, email: true } } },
  });
}

/**
 * Returns referral stats for a FlywheelProfile:
 * count of referred contacts and total revenue they generated.
 */
export async function getReferralStats(flywheelProfileId: string) {
  const referrals = await db.flywheelProfile.findMany({
    where: { referredById: flywheelProfileId },
    select: {
      id: true,
      totalRevenue: true,
      lifecycleStage: true,
      contact: { select: { id: true, name: true, email: true, createdAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const totalRevenue = referrals.reduce(
    (sum, r) => sum + Number(r.totalRevenue ?? 0),
    0
  );
  const convertedCount = referrals.filter((r) => r.lifecycleStage === 'CUSTOMER').length;

  return { referrals, totalRevenue, convertedCount };
}
