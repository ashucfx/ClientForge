// GET  /api/admin/settings/:key  — read a system setting
// PUT  /api/admin/settings/:key  — write a system setting (SUPER_ADMIN only)

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getSetting, setSetting } from '@/lib/systemSettings';
import type { SettingKey } from '@/lib/systemSettings';

const ALLOWED_KEYS: SettingKey[] = [
  'GLOBAL_CURRENCY_PRICING',
  'EXECUTIVE_CONNECT_PRICING',
  'GLOBAL_PRICING_V2',
];

function isKeyAllowed(key: string): boolean {
  if (ALLOWED_KEYS.includes(key as SettingKey)) return true;
  return /^CLIENT_(?:PRICE|UPGRADE_ENABLED|INFO)_[a-zA-Z0-9_-]+(?:_(?:INR|USD))?$/.test(key);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { key: string } }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const key = params.key;
  if (!isKeyAllowed(key)) {
    return NextResponse.json({ error: 'Unknown setting key' }, { status: 400 });
  }

  const value = await getSetting(key as SettingKey);
  return NextResponse.json({ key, value });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { key: string } }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Only SUPER_ADMIN can write settings
  if (session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden — SUPER_ADMIN role required' }, { status: 403 });
  }

  const key = params.key;
  if (!isKeyAllowed(key)) {
    return NextResponse.json({ error: 'Unknown setting key' }, { status: 400 });
  }

  const body = await req.json() as { value: unknown };
  if (body.value === undefined) {
    return NextResponse.json({ error: '"value" field is required' }, { status: 400 });
  }

  await setSetting(key, body.value, session.adminId);
  return NextResponse.json({ key, value: body.value });
}
