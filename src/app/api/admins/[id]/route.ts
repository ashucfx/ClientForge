// src/app/api/admins/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/authToken';
import { getAdminSessionSecret, getAdminCookieName, hashPassword } from '@/lib/auth';

async function isSuperAdmin() {
  try {
    const token = cookies().get(getAdminCookieName())?.value;
    if (!token) return false;
    const payload = await verifySessionToken(getAdminSessionSecret(), token);
    return payload?.role === 'SUPER_ADMIN';
  } catch {
    return false;
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!await isSuperAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { id } = params;
    const body = await request.json();
    const { role, isActive, brandAccess, password } = body;

    const data: Record<string, any> = {};
    if (role) data.role = role;
    if (typeof isActive === 'boolean') data.isActive = isActive;
    if (typeof password === 'string' && password.length > 0) {
      if (password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
      }
      data.passwordHash = await hashPassword(password);
    }
    if (Array.isArray(brandAccess)) {
      const VALID_BRANDS = ['catalyst', 'ripple_nexus'];
      const access = brandAccess.filter((b: unknown): b is string => typeof b === 'string' && VALID_BRANDS.includes(b));
      if (access.length === 0) {
        return NextResponse.json({ error: 'Admin must keep access to at least one portal' }, { status: 400 });
      }
      data.brandAccess = access;
    }

    // Prevent deactivating or changing role of the last SUPER_ADMIN
    if (role !== 'SUPER_ADMIN' || isActive === false) {
      const targetAdmin = await prisma.adminUser.findUnique({ where: { id } });
      if (targetAdmin?.role === 'SUPER_ADMIN') {
        const superAdmins = await prisma.adminUser.count({ where: { role: 'SUPER_ADMIN', isActive: true } });
        if (superAdmins <= 1) {
          return NextResponse.json({ error: 'Cannot demote or deactivate the last active SUPER_ADMIN' }, { status: 400 });
        }
      }
    }

    const admin = await prisma.adminUser.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        role: true,
        brandAccess: true,
        isActive: true,
      },
    });

    return NextResponse.json({ admin });
  } catch (err) {
    console.error('Update admin error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!await isSuperAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { id } = params;

    // Prevent deleting the last SUPER_ADMIN
    const targetAdmin = await prisma.adminUser.findUnique({ where: { id } });
    if (targetAdmin?.role === 'SUPER_ADMIN') {
      const superAdmins = await prisma.adminUser.count({ where: { role: 'SUPER_ADMIN' } });
      if (superAdmins <= 1) {
        return NextResponse.json({ error: 'Cannot delete the last SUPER_ADMIN' }, { status: 400 });
      }
    }

    await prisma.adminUser.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Delete admin error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
