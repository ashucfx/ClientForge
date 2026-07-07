// src/app/api/public/geo/route.ts
// Best-effort visitor geo-location from CDN edge headers (Vercel injects
// x-vercel-ip-country on every request; Cloudflare uses cf-ipcountry). Returns
// the ISO-2 code + a supported country name so the checkout can pick the right
// currency. Locally / when no header is present, returns nulls and the client
// falls back to its timezone guess.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { countryNameFromIso } from '@/lib/currency';

export async function GET(req: NextRequest) {
  const iso = (
    req.headers.get('x-vercel-ip-country') ||
    req.headers.get('cf-ipcountry') ||
    ''
  ).toUpperCase();

  const valid = /^[A-Z]{2}$/.test(iso) && iso !== 'XX';
  const countryCode = valid ? iso : null;
  const countryName = countryCode ? countryNameFromIso(countryCode) : null;

  return NextResponse.json(
    { countryCode, countryName },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
