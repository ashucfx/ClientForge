import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const result = await prisma.$queryRaw`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public';
  `;
  return NextResponse.json({ tables: result });
}
