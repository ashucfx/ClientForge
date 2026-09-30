// src/lib/agreements/slaTerms.ts
// Official Catalyst Master Services Agreement & Turnaround SLAs
// Version: CATALYST-SLA-V2026.1

import crypto from 'crypto';

export const CURRENT_SLA_VERSION = 'CATALYST-SLA-V2026.1';

export interface SlaSection {
  title: string;
  content: string;
  subpoints?: string[];
}

export const SLA_AGREEMENT_SECTIONS: SlaSection[] = [
  {
    title: '1. Service Scope & Document Calibration',
    content: 'Catalyst (a division of Ripple Nexus) provides premium executive resume writing, LinkedIn profile optimization, cover letters, portfolio website development, and executive career strategy advisory. All deliverables are strategically calibrated to your chosen career experience tier.',
    subpoints: [
      'Deliverables are custom-authored based on your submitted career profile, target roles, and career intake questionnaire.',
      'Our team crafts ATS-optimized (Applicant Tracking System) positioning, quantified impact metrics, and executive branding aligned with international recruitment standards.',
    ],
  },
  {
    title: '2. Turnaround Times & Delivery SLAs',
    content: 'We adhere to strict turnaround timelines calculated in standard working days (Monday to Friday, excluding national bank holidays):',
    subpoints: [
      'Resume & Cover Letter Initial Draft: 5 to 7 working days from receipt of your completed intake questionnaire.',
      'LinkedIn Profile Optimization: 5 to 7 working days (delivered alongside or immediately following resume finalization).',
      'Executive Connect / Portfolio Website: 7 to 10 working days.',
      'Turnaround SLA timers commence on the next working day following submission of your comprehensive intake questionnaire.',
    ],
  },
  {
    title: '3. Client Cooperation & SLA Clock Pausing',
    content: 'Accurate and compelling career documents require close collaboration. To maintain high-caliber positioning and adhere to our delivery SLAs:',
    subpoints: [
      'You agree to provide true, accurate, and verifiable professional, educational, and achievement details.',
      'If your writer or strategist requests clarification or additional data, we request a response within 48 hours.',
      'If additional information is pending from your side, the SLA delivery clock is paused and resumes upon receipt of complete details.',
    ],
  },
  {
    title: '4. Revision Policy & Fair-Use Terms',
    content: 'Your satisfaction and confidence in your career documents are paramount. We offer complimentary revision cycles under clear, bounded fair-use parameters:',
    subpoints: [
      'Each individual service component includes up to 2 complimentary revision rounds (Resume Rewrite, LinkedIn Profile Optimization, Cover Letter, Portfolio Website).',
      'Draft Review Window: You have 14 calendar days from the delivery of each draft to review and submit revisions via the client portal.',
      'Final Delivery Window: Following final document delivery, you have strictly 7 calendar days to request any final minor corrections (subject to remaining complimentary revision quota).',
      'Post-Window Expiration: Once the 14-day draft window or 7-day post-completion window has elapsed, complimentary revisions are strictly prohibited. Any further revisions require an evaluated out-of-scope quote from your Catalyst team.',
      'Revisions encompass adjustments to tone, bullet refinement, quantifiable metrics, skills prioritization, and formatting emphasis.',
      'A change in the foundational career direction (e.g., pivoting to an entirely different target role, industry, or writing for a different individual) constitutes a new engagement and is outside the complimentary revision scope.',
    ],
  },
  {
    title: '5. Confidentiality, Privacy & Data Protection',
    content: 'We treat your professional information with the highest degree of confidentiality:',
    subpoints: [
      'Your career history, contact details, and financial transactions are never sold, rented, or shared with third-party advertisers.',
      'Only your assigned writer, strategist, and quality assurance lead have access to your raw documents and intake submissions.',
      'Upon final delivery and approval, full copyright and ownership of the completed career deliverables belong entirely to you.',
    ],
  },
  {
    title: '6. Payment, Cancellation & Dispute Resolution',
    content: 'Due to the custom, intellectual, and bespoke advisory nature of our services:',
    subpoints: [
      'Professional research, document analysis, and strategic copywriting commence immediately upon receipt of payment and questionnaire submission.',
      'Services rendered or in-progress are non-refundable.',
      'In the rare event of dissatisfaction, you agree to submit a formal review request through our client portal resolution desk. Both parties agree to make a good-faith effort to resolve any concerns amicably before initiating payment processor disputes or chargebacks.',
    ],
  },
];

/**
 * Computes an immutable SHA-256 digest proving client assent, email, timestamp, and IP.
 */
export function computeAgreementChecksum(params: {
  email: string;
  version: string;
  timestamp: string;
  ipAddress?: string | null;
}): string {
  const payload = [
    params.email.trim().toLowerCase(),
    params.version.trim(),
    params.timestamp.trim(),
    (params.ipAddress || 'unknown').trim(),
  ].join(':::');

  return crypto.createHash('sha256').update(payload).digest('hex');
}
