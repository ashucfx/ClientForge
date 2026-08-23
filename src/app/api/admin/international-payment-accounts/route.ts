import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getAdminSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const accounts = await prisma.internationalBankAccount.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(accounts);
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();

  const account = await prisma.internationalBankAccount.create({
    data: {
      provider: 'RAZORPAY_INTERNATIONAL_BANK_TRANSFER',
      currency: body.currency,
      transferRail: body.transferRail,
      accountName: body.accountName,
      bankName: body.bankName,
      accountNumber: body.accountNumber,
      iban: body.iban,
      sortCode: body.sortCode,
      routingNumber: body.routingNumber,
      routingType: body.routingType,
      swiftBic: body.swiftBic,
      bankAddress: body.bankAddress,
      referenceRequirements: body.referenceRequirements,
      paymentInstructions: body.paymentInstructions,
      country: body.country,
      isActive: body.isActive ?? true,
      isSwiftAvailable: body.isSwiftAvailable ?? false,
    },
  });

  return NextResponse.json(account, { status: 201 });
}
