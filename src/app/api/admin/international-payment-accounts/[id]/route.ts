import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const account = await prisma.internationalBankAccount.findUnique({
    where: { id: params.id },
  });

  if (!account) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  return NextResponse.json(account);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();

  const account = await prisma.internationalBankAccount.update({
    where: { id: params.id },
    data: {
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
      isActive: body.isActive,
      isSwiftAvailable: body.isSwiftAvailable,
    },
  });

  return NextResponse.json(account);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await prisma.internationalBankAccount.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ success: true });
}
