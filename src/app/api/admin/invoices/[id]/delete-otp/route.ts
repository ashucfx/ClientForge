import { NextRequest, NextResponse } from 'next/server';
import { createHmac, randomInt } from 'crypto';
import { Resend } from 'resend';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { BRAND_EMAIL } from '@/lib/config';

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        invoiceNumber: true,
        clientName: true,
        clientEmail: true,
        totalPayable: true,
        currency: true,
        status: true,
        brandId: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Role/brand check
    if (session.role !== 'SUPER_ADMIN' && !session.brandAccess.includes(invoice.brandId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Strict compliance check: Paid / partially paid invoices CANNOT be deleted
    if (invoice.status === 'PAID' || invoice.status === 'PARTIALLY_PAID') {
      return NextResponse.json(
        {
          error: 'Paid or partially paid invoices cannot be deleted for tax and audit compliance. Mark as void or cancelled instead.',
        },
        { status: 400 }
      );
    }

    // Lookup admin email
    const admin = await prisma.adminUser.findUnique({
      where: { id: session.adminId },
      select: { email: true },
    });

    const adminEmail = admin?.email || process.env.ADMIN_NOTIFY_EMAIL || BRAND_EMAIL;

    // Generate 6-digit cryptographic OTP
    const secret = process.env.ADMIN_SESSION_SECRET || process.env.CAREER_PORTAL_SECRET || 'catalyst-otp-secret';
    const code = String(randomInt(100000, 1000000)).padStart(6, '0');
    const exp = Date.now() + 5 * 60 * 1000; // 5 minutes validity

    const sig = createHmac('sha256', secret)
      .update(`${invoice.id}:${code}:${exp}`)
      .digest('hex');

    const otpToken = Buffer.from(
      JSON.stringify({ invoiceId: invoice.id, exp, sig })
    ).toString('base64');

    // Email OTP to administrator
    await resend.emails.send({
      from: `Catalyst Security <${process.env.FROM_EMAIL ?? BRAND_EMAIL}>`,
      to: adminEmail,
      subject: `${code} — Invoice Deletion Authorization Code`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"/></head>
        <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif;margin:0;padding:24px;background:#0A0B0D;color:#F4F1EB;">
          <div style="max-width:520px;margin:0 auto;background:#14161A;border:1px solid rgba(184,147,91,0.25);border-radius:16px;padding:32px;box-shadow:0 10px 30px rgba(0,0,0,0.5);">
            <div style="text-align:center;margin-bottom:20px;">
              <span style="font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#B8935B;font-weight:700;">Security Authorization</span>
              <h1 style="font-size:20px;margin:8px 0 0;color:#FFFFFF;font-weight:800;">Authorize Invoice Deletion</h1>
            </div>

            <p style="font-size:13px;line-height:1.6;color:#94A3B8;margin-bottom:20px;text-align:center;">
              An administrator requested to permanently delete invoice <strong style="color:#FFFFFF;">${invoice.invoiceNumber}</strong> (${invoice.currency} ${invoice.totalPayable.toLocaleString()}) issued to <strong style="color:#FFFFFF;">${invoice.clientName}</strong>.
            </p>

            <div style="background:#1B1E24;border:1px dashed #B8935B;border-radius:12px;padding:18px;text-align:center;margin:24px 0;">
              <span style="font-size:11px;color:#94A3B8;display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;">Your 6-Digit One-Time Code</span>
              <span style="font-size:32px;font-weight:800;letter-spacing:8px;color:#B8935B;font-family:monospace;">${code}</span>
            </div>

            <p style="font-size:11px;color:#64748B;line-height:1.5;text-align:center;margin:0;">
              This code expires in <strong>5 minutes</strong>. If you did not initiate this action, someone may be attempting unauthorized data deletion. Please verify immediately.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    return NextResponse.json({
      success: true,
      otpToken,
      recipient: adminEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
      message: 'Verification code sent to administrator email',
    });
  } catch (error: any) {
    console.error('Delete OTP error:', error);
    return NextResponse.json({ error: error.message || 'Failed to dispatch OTP' }, { status: 500 });
  }
}
