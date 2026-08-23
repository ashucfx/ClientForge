import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

const RAZORPAY_PRESET_ACCOUNTS = [
  {
    currency: 'USD',
    transferRail: 'ACH',
    accountName: 'Ripple Nexus',
    bankName: 'Community Federal Savings Bank',
    accountNumber: '8308075689',
    routingNumber: '026073150',
    routingType: 'ach_routing_number',
    bankAddress: '5 Penn Plaza, 14th Floor, New York, NY 10001, US',
    country: 'US',
    isActive: true,
  },
  {
    currency: 'GBP',
    transferRail: 'FPS / BACS / CHAPS',
    accountName: 'Ripple Nexus',
    bankName: 'Banking Circle S.A. UK Branch',
    accountNumber: '48233417',
    routingNumber: '608382',
    routingType: 'Sort_Code',
    bankAddress: '68 King William Street, London, EC4N 7HR, United Kingdom',
    country: 'GB',
    isActive: true,
  },
  {
    currency: 'EUR',
    transferRail: 'SEPA / SEPA Instant',
    accountName: 'Ripple Nexus',
    bankName: 'Banking Circle Germany',
    accountNumber: 'DE81202208000048233417',
    routingNumber: 'SXPYDEHH',
    routingType: 'BIC_SWIFT',
    bankAddress: 'Banking Circle S.A. – German Branch, Maximilianstraße 54, 80538 München',
    country: 'EU',
    isActive: true,
  },
  {
    currency: 'CAD',
    transferRail: 'EFT',
    accountName: 'Ripple Nexus',
    bankName: 'Digital Commerce Bank',
    accountNumber: '919785055',
    routingNumber: '035210009',
    routingType: 'routing_code',
    bankAddress: '736 Meridian Road N.E, Calgary, Alberta, CA',
    country: 'CA',
    isActive: true,
  },
  {
    currency: 'AUD',
    transferRail: 'NPP / BECS / Osko',
    accountName: 'Ripple Nexus',
    bankName: 'BC Payments Australia Pty Ltd',
    accountNumber: '048233418',
    routingNumber: '252000',
    routingType: 'BSB Number',
    bankAddress: 'Level 11/10 Carrington St, Sydney NSW 2000, Australia',
    country: 'AU',
    isActive: true,
  },
  {
    currency: 'DKK',
    transferRail: 'DKK Local',
    accountName: 'Ripple Nexus',
    bankName: 'Banking Circle Denmark',
    accountNumber: 'DK0489000048233417',
    routingNumber: 'SXPYDKKK',
    routingType: 'BIC_SWIFT',
    bankAddress: 'Lautrupsgade 13-15 2100 Copenhagen',
    country: 'DK',
    isActive: true,
  },
];

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = [];
  for (const acc of RAZORPAY_PRESET_ACCOUNTS) {
    const existing = await prisma.internationalBankAccount.findFirst({
      where: { currency: acc.currency },
    });

    if (existing) {
      const updated = await prisma.internationalBankAccount.update({
        where: { id: existing.id },
        data: acc,
      });
      results.push(updated);
    } else {
      const created = await prisma.internationalBankAccount.create({
        data: {
          provider: 'RAZORPAY_INTERNATIONAL_BANK_TRANSFER',
          ...acc,
        },
      });
      results.push(created);
    }
  }

  return NextResponse.json({ success: true, count: results.length, accounts: results });
}
