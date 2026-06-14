import nodemailer from 'nodemailer';
import { getBrand } from '../brand/registry';
import { BRAND_EMAIL } from '../config';

// Create reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com', // Replace with theripplenexus SMTP host
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendMarketingEmail(
  to: string,
  subject: string,
  htmlContent: string,
  brandId: string,
  campaignLeadId: string
): Promise<void> {
  const brand = getBrand(brandId);
  const portalUrl = brand.portalUrl;

  // Unsubscribe and tracking URLs
  const unsubscribeUrl = `${portalUrl}/api/public/unsubscribe?lead=${campaignLeadId}`;
  const trackingPixelUrl = `${portalUrl}/api/public/track/open?lead=${campaignLeadId}`;
  
  // Intercept links for click tracking
  // We use a simple regex to find href="..." and wrap it
  const clickTrackBaseUrl = `${portalUrl}/api/public/track/click?lead=${campaignLeadId}&url=`;
  const trackedHtmlContent = htmlContent.replace(/href="([^"]+)"/g, (match, url) => {
    // Don't track mailto or tel links
    if (url.startsWith('mailto:') || url.startsWith('tel:')) return match;
    // Don't double track
    if (url.includes('/api/public/track/click')) return match;
    
    return `href="${clickTrackBaseUrl}${encodeURIComponent(url)}"`;
  });

  // We append the tracking pixel to the end of the content
  const contentWithPixel = `${trackedHtmlContent}
    <img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none;"/>
  `;

  // Build the premium HTML wrapper
  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${subject}</title>
  <style type="text/css">
    body, table, td, p, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; border-collapse:collapse; }
    img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
    @media only screen and (max-width:600px) {
      .email-container { width:100% !important; }
      .mobile-pad { padding:18px 14px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${brand.emailBg};word-break:break-word;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${brand.emailBg}">
<tr><td align="center" style="padding:28px 12px;">

  <!-- Email Card -->
  <table role="presentation" class="email-container" width="620" cellpadding="0" cellspacing="0"
         style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(10,11,13,0.12);">
    
    <!-- Header -->
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
                    <div style="font-family:${brand.fontSerif};font-size:18px;font-weight:400;color:${brand.id === 'catalyst' ? '#F4F1EB' : '#F4F5FA'};letter-spacing:2px;line-height:1;white-space:nowrap;">
                      ${brand.name.toUpperCase()}
                    </div>
                    <div style="font-family:Helvetica,Arial,sans-serif;font-size:9px;color:${brand.id === 'catalyst' ? 'rgba(184,147,91,0.80)' : 'rgba(34,211,238,0.80)'};letter-spacing:1.8px;text-transform:uppercase;margin-top:4px;white-space:nowrap;">
                      ${brand.tagline}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Accent bar -->
    <tr>
      <td height="3" style="background:${brand.accentBar};font-size:0;line-height:0;">&nbsp;</td>
    </tr>

    <!-- Body Content -->
    <tr>
      <td class="mobile-pad" style="padding:32px 36px 32px;font-family:Helvetica,Arial,sans-serif;font-size:16px;color:#4a5568;line-height:1.75;">
        ${contentWithPixel}
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background:#F5F3EE;padding:22px 36px;border-top:1px solid #EDE9DF;border-radius:0 0 16px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td valign="middle">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#c4c9d8;line-height:1.6;text-align:center;">
                You are receiving this email because you opted in at ${brand.name}.<br/>
                If you no longer wish to receive these emails, you can 
                <a href="${unsubscribeUrl}" style="color:#c4c9d8;text-decoration:underline;">unsubscribe here</a>.
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

  const info = await transporter.sendMail({
    from: `"${brand.name}" <${brand.fromEmail}>`, // sender address
    to, // list of receivers
    subject, // Subject line
    html, // html body
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    }
  });

  console.log('[MarketingMailer] Message sent: %s', info.messageId);
}
