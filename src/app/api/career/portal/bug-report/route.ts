import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';
import { Resend } from 'resend';
import { BRAND_EMAIL } from '@/lib/config';

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
    const payload = await verifyPortalToken(token);
    
    // We can allow anonymous bug reports or strictly require auth
    // Let's require auth for portal clients
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await db.careerClient.findUnique({
      where: { id: payload.clientId },
      select: { id: true, name: true, email: true },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const body = await req.json();
    const { description, url } = body;

    if (!description) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }

    const bugReport = await db.bugReport.create({
      data: {
        clientId: client.id,
        clientName: client.name,
        clientEmail: client.email,
        description,
        url: url || undefined,
        status: 'OPEN',
      },
    });

    // ── Dispatch instant alert email to administrator ──
    try {
      const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || BRAND_EMAIL;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://catalyst.theripplenexus.com';
      await resend.emails.send({
        from: `Catalyst Alerts <${process.env.FROM_EMAIL ?? BRAND_EMAIL}>`,
        to: adminEmail,
        subject: `🚨 [Bug Report] ${client.name} reported an issue`,
        html: `
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"/></head>
          <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif;margin:0;padding:24px;background:#0A0B0D;color:#F4F1EB;">
            <div style="max-width:540px;margin:0 auto;background:#14161A;border:1px solid rgba(184,147,91,0.25);border-radius:16px;padding:32px;box-shadow:0 10px 30px rgba(0,0,0,0.5);">
              <div style="margin-bottom:20px;">
                <span style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#F87171;font-weight:700;">Client Diagnostics Alert</span>
                <h1 style="font-size:20px;margin:8px 0 0;color:#FFFFFF;font-weight:800;">New Bug Report Submitted</h1>
              </div>

              <div style="background:#1B1E24;border:1px solid #2D3139;border-radius:12px;padding:16px;margin:20px 0;">
                <table style="width:100%;border-collapse:collapse;font-size:13px;line-height:1.8;">
                  <tr>
                    <td style="color:#94A3B8;width:90px;">Client:</td>
                    <td style="color:#FFFFFF;font-weight:600;">${client.name}</td>
                  </tr>
                  <tr>
                    <td style="color:#94A3B8;">Email:</td>
                    <td style="color:#B8935B;font-family:monospace;">${client.email}</td>
                  </tr>
                  ${url ? `
                  <tr>
                    <td style="color:#94A3B8;">Location:</td>
                    <td style="color:#94A3B8;font-size:12px;word-break:break-all;">${url}</td>
                  </tr>` : ''}
                </table>
              </div>

              <div style="background:#0F1013;border-left:3px solid #B8935B;border-radius:4px;padding:14px 16px;margin:20px 0;">
                <div style="font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Issue Description</div>
                <div style="font-size:13px;line-height:1.6;color:#E2E8F0;white-space:pre-wrap;">${description}</div>
              </div>

              <div style="text-align:center;margin-top:28px;">
                <a href="${appUrl}/bugs" style="display:inline-block;padding:12px 28px;background:#B8935B;color:#FFFFFF;text-decoration:none;border-radius:10px;font-weight:700;font-size:13px;">
                  Open Bug Reports & Diagnostic Hub →
                </a>
              </div>
            </div>
          </body>
          </html>
        `,
      });
    } catch (emailErr) {
      console.error('[BugReport] Failed to dispatch admin email alert:', emailErr);
    }

    return NextResponse.json({ success: true, id: bugReport.id });
  } catch (error: any) {
    console.error('Bug report error:', error);
    return NextResponse.json({ error: 'Failed to submit bug report' }, { status: 500 });
  }
}
