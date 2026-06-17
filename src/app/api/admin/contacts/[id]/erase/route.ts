import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Super admin required' }, { status: 403 });
  }

  const contact = await db.contact.findUnique({
    where: { id: params.id },
    include: { flywheelProfile: true },
  });
  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

  await db.$transaction(async (tx) => {
    await tx.contact.update({
      where: { id: params.id },
      data: {
        name:        '[ERASED]',
        email:       `erased-${params.id}@deleted.invalid`,
        phone:       null,
        companyName: null,
        city:        null,
        industry:    null,
        jobTitle:    null,
        linkedinUrl: null,
        status:      'ARCHIVED',
      },
    });

    if (contact.flywheelProfile) {
      await tx.flywheelProfile.update({
        where: { id: contact.flywheelProfile.id },
        data: { optInStatus: false, optInSource: 'DATA_ERASURE' },
      });
    }

    await tx.auditLog.create({
      data: {
        tenantId: 'system',
        adminId:  session.adminId,
        action:   'CONTACT_ERASED',
        entity:   'Contact',
        entityId: params.id,
        changes:  { reason: 'GDPR right-to-erasure request' },
      },
    });
  });

  return NextResponse.json({ ok: true });
}
