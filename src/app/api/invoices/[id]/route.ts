// src/app/api/invoices/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
  });

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  return NextResponse.json({ invoice });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const invoice = await prisma.invoice.update({
      where: { id: params.id },
      data: body,
    });
    return NextResponse.json({ invoice });
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
