// src/app/api/admin/marketing/templates/preview/route.ts
// Admin-only: render a marketing template through the exact send-time shell so
// the gallery preview matches what clients actually receive. Read-only.
//   GET /api/admin/marketing/templates/preview?id=<templateId>&brandId=catalyst

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getTemplateById } from '@/lib/marketing/templates';
import { renderMarketingShell, personalize } from '@/lib/flywheel/marketingMailer';

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  const brandId = req.nextUrl.searchParams.get('brandId') || session.activeTenant || 'catalyst';
  const tpl = id ? getTemplateById(id) : null;
  if (!tpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  // Preview renders merge tags exactly as a real send would. By default we show
  // the generic fallback ("Hi there,") — what a recipient with no first name on
  // file receives. Real sends substitute each contact's actual first name.
  // Pass ?name=Priya to preview against a specific name.
  const brandName = brandId === 'ripple_nexus' ? 'Ripple Nexus' : 'Catalyst';
  const sampleName = req.nextUrl.searchParams.get('name') || '';
  const body = personalize(tpl.bodyHtml, { name: sampleName, brandName });
  const subject = personalize(tpl.subject, { name: sampleName, brandName });
  const html = renderMarketingShell(body, subject, brandId, '#');

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
