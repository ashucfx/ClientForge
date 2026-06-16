import nodemailer from 'nodemailer';

// Use environment variables for SMTP configuration
// These should be added to the .env file
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const SMTP_USER = process.env.SMTP_USER || process.env.FROM_EMAIL;
const SMTP_PASS = process.env.SMTP_PASS;

/**
 * Shared Nodemailer Transporter for Sales, Marketing, and Proposals.
 * This ensures we do not consume Resend quota for marketing efforts.
 */
export const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // true for 465, false for other ports
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});
