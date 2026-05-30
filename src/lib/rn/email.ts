import { Resend } from 'resend';
import { getBrand } from '@/lib/brand/registry';

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendRnOnboardingEmail(to: string, name: string, portalUrl: string) {
  const brand = getBrand('ripple_nexus');
  
  try {
    await resend.emails.send({
      from: `${brand.name} <${brand.fromEmail}>`,
      reply_to: brand.replyTo,
      to,
      subject: `Welcome to ${brand.name} - Your Client Portal`,
      html: `
        <div style="font-family: Helvetica, Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto;">
          <h2>Welcome, ${name}!</h2>
          <p>Thank you for partnering with ${brand.name}. Your project space has been created.</p>
          <p>You can access your client portal, submit forms, track progress, and communicate with our team using your secure magic link below:</p>
          <div style="margin: 30px 0;">
            <a href="${portalUrl}" style="background-color: ${brand.primaryColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Access Client Portal</a>
          </div>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p><a href="${portalUrl}" style="color: ${brand.primaryColor}; word-break: break-all;">${portalUrl}</a></p>
          <p>Best regards,<br/>The ${brand.name} Team</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('[RN Email] Failed to send onboarding email:', err);
  }
}

export async function sendRnOtpEmail(to: string, otp: string) {
  const brand = getBrand('ripple_nexus');
  
  try {
    await resend.emails.send({
      from: `${brand.name} <${brand.fromEmail}>`,
      reply_to: brand.replyTo,
      to,
      subject: `Your ${brand.name} Login PIN`,
      html: `
        <div style="font-family: Helvetica, Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto;">
          <h2>Login Verification</h2>
          <p>Please use the following 6-digit PIN to securely log in to your ${brand.name} client portal.</p>
          <div style="margin: 24px 0; font-size: 32px; font-weight: bold; letter-spacing: 4px; color: ${brand.primaryColor}; text-align: center; background: #f4f4f5; padding: 20px; border-radius: 8px;">
            ${otp}
          </div>
          <p>This PIN will expire shortly. If you did not request this, please ignore this email.</p>
          <p>Best regards,<br/>The ${brand.name} Team</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('[RN Email] Failed to send OTP email:', err);
  }
}
