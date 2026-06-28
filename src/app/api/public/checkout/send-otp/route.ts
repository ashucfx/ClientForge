import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createHmac, randomInt } from 'crypto';
import { Resend } from 'resend';
import { enforcePublicRateLimit } from '@/lib/publicRateLimit';
import { BRAND_EMAIL } from '@/lib/config';
import { prisma as db } from '@/lib/db';

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = (body.email ?? '').toLowerCase().trim();
    const name = (body.name ?? '').trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const limited = await enforcePublicRateLimit(req, {
      action: 'checkout_otp',
      email,
      ipLimit:    { limit: 15, windowMs: 60 * 60 * 1000 },
      emailLimit: { limit: 5,  windowMs: 60 * 60 * 1000 },
    });
    if (limited) return limited;

    const secret = process.env.CAREER_PORTAL_SECRET;
    if (!secret) throw new Error('CAREER_PORTAL_SECRET is not configured');

    const code = String(randomInt(100000, 1000000)).padStart(6, '0');
    const exp  = Date.now() + 10 * 60 * 1000;
    const sig  = createHmac('sha256', secret)
      .update(`${email}:${code}:${exp}`)
      .digest('hex');

    const firstName = name.split(' ')[0] || 'there';

    const { error: sendError } = await resend.emails.send({
      from: `Catalyst <${process.env.FROM_EMAIL ?? BRAND_EMAIL}>`,
      to: email,
      subject: `${code} — your Catalyst verification code`,
      html: `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Verify your email</title>
  <style>
    body { margin: 0; padding: 0; background-color: #F0EDE6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    a { text-decoration: none; }
    @media only screen and (max-width: 600px) {
      .outer-wrap  { padding: 16px 0 !important; }
      .card        { border-radius: 0 !important; }
      .card-body   { padding: 28px 20px !important; }
      .code-box    { padding: 20px 16px !important; }
      .code-text   { font-size: 34px !important; letter-spacing: 8px !important; }
      .header-pad  { padding: 16px 20px 14px !important; }
      .footer-pad  { padding: 18px 20px !important; }
    }
  </style>
</head>
<body>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="outer-wrap" style="background:#F0EDE6; padding: 40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 4px 28px rgba(10,11,13,0.12);">

          <!-- Gold bar -->
          <tr>
            <td style="height:3px; background:linear-gradient(90deg,#B8935B 0%,#D4AF7A 60%,#B8935B 100%); line-height:3px; font-size:3px;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td class="header-pad" style="background:linear-gradient(135deg,#0A0B0D 0%,#1C1812 60%,#2A1F0E 100%); padding:20px 28px 18px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:44px; vertical-align:middle; padding-right:14px;">
                    <table role="presentation" width="36" height="36" cellpadding="0" cellspacing="0" style="background:#0A0B0D; border-radius:8px; border:1px solid rgba(184,147,91,0.35);">
                      <tr><td align="center" valign="middle" style="font-family:Georgia,'Times New Roman',serif; font-size:22px; font-weight:700; color:#F4F1EB; line-height:36px;">C</td></tr>
                    </table>
                  </td>
                  <td style="vertical-align:middle;">
                    <p style="margin:0; font-family:Georgia,'Times New Roman',serif; font-size:16px; font-weight:400; color:#F4F1EB; letter-spacing:1.5px; line-height:1.2;">CATALYST</p>
                    <p style="margin:3px 0 0; font-size:9px; font-weight:600; color:rgba(184,147,91,0.80); letter-spacing:1.8px; text-transform:uppercase;">CareerPilot</p>
                  </td>
                  <td style="vertical-align:middle; text-align:right;">
                    <span style="display:inline-block; padding:3px 10px; background:rgba(184,147,91,0.18); border:1px solid rgba(184,147,91,0.40); border-radius:20px; font-size:10px; font-weight:600; color:#D4AF7A; letter-spacing:0.5px;">CareerPilot</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Gold fade line -->
          <tr><td style="height:1px; background:linear-gradient(90deg,#B8935B 0%,transparent 100%); line-height:1px; font-size:1px;">&nbsp;</td></tr>

          <!-- Body -->
          <tr>
            <td class="card-body" style="padding:36px 32px;">

              <p style="margin:0 0 6px; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#B8935B;">Email Verification</p>
              <h1 style="margin:0 0 12px; font-size:26px; font-weight:700; color:#0A0B0D; line-height:1.3; letter-spacing:-0.3px;">Hi ${firstName}, check your inbox</h1>
              <p style="margin:0 0 28px; font-size:15px; color:#475569; line-height:1.7;">Enter the code below to continue with your order. It expires in <strong style="color:#0A0B0D;">10 minutes</strong>.</p>

              <!-- Code box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td class="code-box" style="background:#F8F5F1; border:1px solid #EBE4D9; border-radius:10px; padding:26px 24px; text-align:center;">
                    <p class="code-text" style="margin:0; font-family:'Courier New',Courier,monospace; font-size:42px; font-weight:700; letter-spacing:12px; color:#0A0B0D; line-height:1;">${code}</p>
                    <p style="margin:10px 0 0; font-size:12px; color:#94a3b8;">Valid for 10 minutes only</p>
                  </td>
                </tr>
              </table>

              <!-- Tip box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="border-left:3px solid #B8935B; background:rgba(184,147,91,0.06); border-radius:0 8px 8px 0; padding:12px 16px;">
                    <p style="margin:0; font-size:13px; color:#475569; line-height:1.6;">
                      <strong style="color:#0A0B0D;">Didn't get it?</strong> Check your spam or junk folder. If it still hasn't arrived, use the Resend code button on the checkout page.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0; font-size:12px; color:#94a3b8; line-height:1.6; border-left:3px solid #e2e8f0; padding-left:12px;">
                If you did not attempt to place an order on Catalyst, you can safely ignore this email. Your account remains secure.
              </p>

            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="height:1px; background:#EDE9DF; line-height:1px; font-size:1px;">&nbsp;</td></tr>

          <!-- Footer -->
          <tr>
            <td class="footer-pad" style="background:#F5F3EE; padding:22px 32px; text-align:center;">
              <p style="margin:0 0 4px; font-family:Georgia,'Times New Roman',serif; font-size:12px; color:#B8935B; letter-spacing:2px;">CATALYST</p>
              <p style="margin:0 0 8px; font-size:12px; color:#64748b;">
                <a href="https://catalyst.theripplenexus.com" style="color:#9A7540; text-decoration:none; font-weight:500;">catalyst.theripplenexus.com</a>
                &nbsp;·&nbsp;
                <a href="mailto:catalyst@theripplenexus.com" style="color:#9A7540; text-decoration:none; font-weight:500;">catalyst@theripplenexus.com</a>
              </p>
              <p style="margin:0 0 6px; font-size:11px; color:#cbd5e1; line-height:1.5;">© ${new Date().getFullYear()} Catalyst. All rights reserved.</p>
              <p style="margin:0; font-size:10px; color:#94a3b8; letter-spacing:0.5px;">Powered by <span style="font-weight:500; color:#64748b;">Ripple Nexus</span></p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });

    if (sendError) {
      console.error('Resend send error:', sendError);
      void db.sysEmailLog.create({ data: {
        to: email, subject: 'Checkout OTP', trigger: 'CHECKOUT_OTP',
        channel: 'resend', status: 'failed',
        error: sendError.message ?? 'Resend error',
        metadata: { source: 'checkout', name },
      }}).catch(() => {});
      throw new Error(sendError.message ?? 'Email delivery failed');
    }

    void db.sysEmailLog.create({ data: {
      to: email, subject: 'Checkout OTP', trigger: 'CHECKOUT_OTP',
      channel: 'resend', status: 'sent',
      metadata: { source: 'checkout', name },
    }}).catch(() => {});

    return NextResponse.json({ token: `${sig}.${exp}` });
  } catch (error) {
    console.error('OTP send error:', error);
    return NextResponse.json({ error: 'Failed to send verification code. Please try again.' }, { status: 500 });
  }
}
