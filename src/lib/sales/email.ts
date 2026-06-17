import { transporter } from '../smtp';
import { getBrand } from '../brand/registry';
import { formatCurrency } from '../pricing';
import { prisma as db } from '../db';
import type { LineItem } from '@/types';

export async function sendProposalEmail(proposalId: string): Promise<void> {
  const proposal = await db.proposal.findUniqueOrThrow({
    where: { id: proposalId },
    include: { inquiry: true }
  });

  const brand = getBrand('catalyst'); // Proposals are currently for Catalyst
  const sym = proposal.currencySymbol;
  const fmt = (n: number) => formatCurrency(n, sym);
  const firstName = proposal.inquiry.name.split(' ')[0];
  const validUntilStr = new Date(proposal.validUntil).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const proposalDateStr = new Date(proposal.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const lineItemsArr = proposal.lineItems as unknown as LineItem[];
  const packageLabel = proposal.title;
  
  const proposalUrl = `${brand.portalUrl}/proposal/${proposal.publicToken}`;

  const payBtnHTML = `<!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
          href="${proposalUrl}" style="height:52px;v-text-anchor:middle;width:260px;" arcsize="15%"
          stroke="f" fillcolor="${brand.primaryColor}">
          <w:anchorlock/>
          <center style="color:#ffffff;font-family:Helvetica,sans-serif;font-size:17px;font-weight:700;">
            Review & Accept Proposal
          </center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-->
        <a href="${proposalUrl}"
           target="_blank"
           style="display:inline-block;background:linear-gradient(135deg,${brand.primaryColor} 0%,${brand.primaryDark} 100%);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-family:Helvetica,Arial,sans-serif;font-size:17px;font-weight:800;letter-spacing:0.3px;box-shadow:0 4px 16px ${brand.primaryLight};mso-hide:all;">
          Review & Accept Proposal
        </a>
        <!--<![endif]-->`;

  const lineItemRows = lineItemsArr.map((item, idx) => {
    const lt = item.qty * item.unitPrice;
    const isFree = lt === 0;
    const isLast = idx === lineItemsArr.length - 1;
    const borderStyle = isLast ? '' : 'border-bottom:1px solid #EDE9DF;';
    const iconBg = isFree ? '#f0fdf4' : '#F5F2EC';
    const iconColor = isFree ? '#16a34a' : brand.primaryColor;
    const iconNum = String(idx + 1);
    return `<tr>
        <td style="padding:12px 16px;${borderStyle}">
          <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
            <tr>
              <td width="30" valign="middle">
                <div style="width:26px;height:26px;background:${iconBg};border-radius:50%;text-align:center;line-height:26px;font-size:11px;font-weight:700;font-family:Helvetica,Arial,sans-serif;color:${iconColor};">${iconNum}</div>
              </td>
              <td style="padding-left:10px;" valign="middle">
                <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#0f1c3d;font-weight:600;">${item.description}</div>
                ${item.qty !== 1 ? `<div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#6b7280;margin-top:1px;">Qty: ${item.qty} &times; ${fmt(item.unitPrice)}</div>` : ''}
              </td>
              <td align="right" valign="middle" style="white-space:nowrap;">
                ${isFree
                  ? `<span style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#16a34a;font-weight:700;background:#f0fdf4;padding:3px 10px;border-radius:20px;border:1px solid #bbf7d0;">FREE</span>`
                  : `<span style="font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#0f1c3d;font-weight:700;">${fmt(lt)}</span>`
                }
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
  }).join('');

  const discountRow = proposal.discount > 0 ? `
          <tr>
            <td style="padding:4px 16px;background:#FAFAF8;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#16a34a;">Discount</td>
                  <td align="right" style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#16a34a;">&#8722;${fmt(proposal.discount)}</td>
                </tr>
              </table>
            </td>
          </tr>` : '';

  const taxRow = proposal.tax > 0 ? `
          <tr>
            <td style="padding:4px 16px;background:#FAFAF8;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b7280;">Tax</td>
                  <td align="right" style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b7280;">+${fmt(proposal.tax)}</td>
                </tr>
              </table>
            </td>
          </tr>` : '';

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="x-apple-disable-message-reformatting"/>
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no"/>
  <title>Proposal: ${proposal.title} — ${brand.name}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, p, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; border-collapse:collapse; }
    img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
    @media only screen and (max-width:600px) {
      .email-container  { width:100% !important; }
      .mobile-pad       { padding:18px 14px !important; }
      .mobile-center    { text-align:center !important; }
      .mobile-hide      { display:none !important; }
      .mobile-full      { width:100% !important; display:block !important; }
      .hero-title       { font-size:22px !important; }
      .hdr-badge        { display:none !important; }
      .meta-cell        { display:block !important; width:100% !important; box-sizing:border-box !important; border-right:none !important; border-bottom:1px solid #EDE9DF !important; }
      .badge-cell       { padding:0 2px !important; }
      .total-amount     { font-size:22px !important; }
      .footer-ref       { display:none !important; }
    }
</style>
</head>
<body style="margin:0;padding:0;background-color:${brand.emailBg};word-break:break-word;">

<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:${brand.emailBg};line-height:1px;max-width:0;">
  Hi ${firstName}, your custom proposal for ${fmt(proposal.total)} is ready for your review.&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${brand.emailBg}">
<tr><td align="center" style="padding:28px 12px;">

  <table role="presentation" class="email-container" width="620" cellpadding="0" cellspacing="0"
         style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(10,11,13,0.12);">

    <tr>
      <td style="background:${brand.gradient};padding:28px 36px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td valign="middle">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="middle" style="padding-right:10px;width:44px;">
                    ${brand.logoEmailHtml(44)}
                  </td>
                  <td valign="middle" style="white-space:nowrap;">
                    <div style="font-family:${brand.fontSerif};font-size:18px;font-weight:400;color:#F4F1EB;letter-spacing:2px;line-height:1;white-space:nowrap;">
                      ${brand.name.toUpperCase()}
                    </div>
                    <div style="font-family:Helvetica,Arial,sans-serif;font-size:9px;color:rgba(184,147,91,0.80);letter-spacing:1.8px;text-transform:uppercase;margin-top:4px;white-space:nowrap;">
                      ${brand.tagline}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
            <td class="hdr-badge" align="right" valign="middle">
              <table role="presentation" cellpadding="0" cellspacing="0"
                     style="background:rgba(255,255,255,0.12);border-radius:10px;border:1px solid rgba(255,255,255,0.2);">
                <tr>
                  <td style="padding:10px 18px;text-align:right;">
                    <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1.5px;">Proposal</div>
                    <div style="font-family:Helvetica,Arial,sans-serif;font-size:18px;font-weight:800;color:#ffffff;margin-top:2px;letter-spacing:0.3px;">v${proposal.version}</div>
                    <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:rgba(255,255,255,0.55);margin-top:3px;">${proposalDateStr}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td height="3" style="background:${brand.accentBar};font-size:0;line-height:0;">&nbsp;</td>
    </tr>

    <tr>
      <td class="mobile-pad" style="padding:32px 36px 0;">
        <h1 class="hero-title"
            style="margin:0 0 10px;font-family:Helvetica,Arial,sans-serif;font-size:26px;color:#0d1b4b;font-weight:800;line-height:1.3;">
          Hello, ${firstName},
        </h1>
        <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#4a5568;line-height:1.75;">
          Your custom <strong style="color:${brand.primaryColor};">${packageLabel}</strong> proposal is ready.
          Review the scope and deliverables below, then click <strong>Review & Accept Proposal</strong>.
        </p>
      </td>
    </tr>

    <tr>
      <td class="mobile-pad" style="padding:22px 36px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="background:#F5F3EE;border-radius:12px;border:1px solid #EDE9DF;overflow:hidden;">
          <tr>
            <td class="meta-cell" width="50%" style="padding:14px 18px;border-right:1px solid #EDE9DF;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#7c8db5;text-transform:uppercase;letter-spacing:1.2px;">Prepared For</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#0d1b4b;font-weight:700;margin-top:4px;">${proposal.inquiry.name}</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#6b7280;margin-top:2px;">${proposal.inquiry.email}</div>
            </td>
            <td class="meta-cell" width="50%" style="padding:14px 18px;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#7c8db5;text-transform:uppercase;letter-spacing:1.2px;">Package</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:${brand.primaryColor};font-weight:700;margin-top:4px;">${packageLabel}</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#6b7280;margin-top:2px;">${proposal.inquiry.countryName}</div>
            </td>
          </tr>
          <tr>
            <td class="meta-cell" style="padding:12px 18px;border-top:1px solid #EDE9DF;border-right:1px solid #EDE9DF;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#7c8db5;text-transform:uppercase;letter-spacing:1.2px;">Issue Date</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#0d1b4b;font-weight:600;margin-top:4px;">${proposalDateStr}</div>
            </td>
            <td class="meta-cell" style="padding:12px 18px;border-top:1px solid #EDE9DF;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#7c8db5;text-transform:uppercase;letter-spacing:1.2px;">Valid Until</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#dc2626;font-weight:700;margin-top:4px;">${validUntilStr}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td class="mobile-pad" style="padding:24px 36px 0;">
        <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;color:#7c8db5;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;">
          Scope Summary
        </div>
        <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#4a5568;line-height:1.6;">
          ${proposal.scopeSummary}
        </p>
      </td>
    </tr>

    <tr>
      <td class="mobile-pad" style="padding:24px 36px 0;">
        <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;color:#7c8db5;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;">
          Deliverables Breakdown
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="border-radius:12px;border:1px solid #EDE9DF;overflow:hidden;">
          ${lineItemRows}
          <tr><td style="height:1px;background:#EDE9DF;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="padding:10px 16px 4px;background:#FAFAF8;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b7280;">Subtotal</td>
                  <td align="right" style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b7280;">${fmt(proposal.subtotal)}</td>
                </tr>
              </table>
            </td>
          </tr>
          ${discountRow}
          ${taxRow}
        </table>
      </td>
    </tr>

    <tr>
      <td class="mobile-pad" style="padding:14px 36px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="background:linear-gradient(135deg,#0A0B0D 0%,${brand.primaryColor} 100%);border-radius:12px;">
          <tr>
            <td style="padding:18px 22px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:1px;">Total Proposed</div>
                    <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.5);margin-top:2px;">${proposal.currency} &bull; incl. all fees</div>
                  </td>
                  <td align="right">
                    <div class="total-amount" style="font-family:Helvetica,Arial,sans-serif;font-size:28px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">${fmt(proposal.total)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td class="mobile-pad" style="padding:28px 36px 8px;" align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:320px;">
          <tr>
            <td align="center" style="border-radius:8px;" bgcolor="${brand.primaryColor}">
              ${payBtnHTML}
            </td>
          </tr>
        </table>
        <div style="margin-top:12px;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#9ca3af;">
          Your custom proposal link is secure and unique to you.
        </div>
      </td>
    </tr>

    <tr>
      <td style="background:#F5F3EE;padding:22px 36px;border-top:1px solid #EDE9DF;border-radius:0 0 16px 16px;margin-top:30px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td valign="middle">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="middle" style="padding-right:10px;">
                    ${brand.logoEmailHtml(22)}
                  </td>
                  <td valign="middle">
                    <div style="font-family:${brand.fontSerif};font-size:13px;font-weight:400;color:${brand.primaryColor};letter-spacing:2px;line-height:1;white-space:nowrap;">
                      ${brand.name.toUpperCase()}
                    </div>
                    <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#9ca3af;margin-top:3px;">
                      <a href="mailto:${brand.replyTo}" style="color:#9ca3af;text-decoration:none;">${brand.replyTo}</a>
                      &nbsp;&bull;&nbsp;
                      <a href="${brand.websiteUrl}" style="color:#9ca3af;text-decoration:none;">${brand.websiteLabel}</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding-top:12px;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#c4c9d8;line-height:1.6;text-align:center;border-top:1px solid #e8eeff;padding-top:10px;">
                ${brand.footerLegal}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

  </table>
</td></tr>
</table>
</body>
</html>`;

  // Provide plain-text fallback
  const text = `
Hi ${firstName},

Your custom ${packageLabel} proposal is ready.
Proposal Link: ${proposalUrl}

Scope Summary:
${proposal.scopeSummary}

Total Proposed: ${fmt(proposal.total)} ${proposal.currency}
Valid Until: ${validUntilStr}

Questions? Reply to this email or write to ${brand.replyTo}

${brand.name} | ${brand.websiteUrl}
  `.trim();

  const subject = `Your Custom Proposal: ${proposal.title} — ${brand.name}`;
  try {
    await transporter.sendMail({
      from: `"${brand.name}" <${process.env.SMTP_USER || process.env.FROM_EMAIL || 'catalyst@theripplenexus.com'}>`,
      replyTo: brand.replyTo,
      to: proposal.inquiry.email,
      subject,
      html,
      text,
    });
    console.log(`[SMTP] Proposal email sent successfully to ${proposal.inquiry.email}`);
    const { prisma } = await import('@/lib/db');
    prisma.sysEmailLog.create({
      data: {
        to: proposal.inquiry.email,
        subject,
        trigger: 'PROPOSAL_SENT',
        channel: 'smtp',
        status: 'sent',
        metadata: { proposalId, inquiryId: proposal.inquiryId, version: proposal.version },
      },
    }).catch(() => null);
  } catch (error) {
    console.error(`[SMTP] Error sending proposal email:`, error);
    const { prisma } = await import('@/lib/db');
    prisma.sysEmailLog.create({
      data: {
        to: proposal.inquiry.email,
        subject,
        trigger: 'PROPOSAL_SENT',
        channel: 'smtp',
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        metadata: { proposalId, inquiryId: proposal.inquiryId },
      },
    }).catch(() => null);
    throw new Error('Failed to send proposal email via SMTP.');
  }
}
