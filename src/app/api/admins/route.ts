// src/app/api/admins/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { headers } from 'next/headers';
import { hashPassword } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/authToken';
import { getAdminSessionSecret, getAdminCookieName } from '@/lib/auth';

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

export async function GET(request: NextRequest) {
  if (!await isSuperAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const admins = await prisma.adminUser.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        brandAccess: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ admins });
  } catch (err) {
    console.error('Fetch admins error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!await isSuperAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { email, password, role, brandAccess } = body;

    if (!email || !password || !role) {
      return NextResponse.json({ error: 'Email, password, and role are required' }, { status: 400 });
    }

    // Portal access: explicit selection, validated against known brands.
    const VALID_BRANDS = ['catalyst', 'ripple_nexus'];
    let access: string[] = Array.isArray(brandAccess)
      ? brandAccess.filter((b: unknown): b is string => typeof b === 'string' && VALID_BRANDS.includes(b))
      : VALID_BRANDS;
    if (access.length === 0) {
      return NextResponse.json({ error: 'Select at least one portal for this admin' }, { status: 400 });
    }

    const existing = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      return NextResponse.json({ error: 'Admin user with this email already exists' }, { status: 400 });
    }

    const admin = await prisma.adminUser.create({
      data: {
        email: email.toLowerCase(),
        passwordHash: await hashPassword(password),
        role,
        brandAccess: access,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        role: true,
        brandAccess: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ admin }, { status: 201 });
  } catch (err) {
    console.error('Create admin error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
