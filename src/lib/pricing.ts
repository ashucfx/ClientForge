// src/lib/pricing.ts

import type { ClientType, ClientTypePricing, PricingCalculation } from '@/types';

// ─────────────────────────────────────────────
// BASE PRICING (INR) — competitive market rates
// ─────────────────────────────────────────────
export const BASE_PRICING: Record<ClientType, ClientTypePricing> = {
  FRESHER: {
    resume:      499,
    linkedin:    349,
    coverLetter: 0,
    portfolio:   4999,
  },
  MID_CAREER: {
    resume:      799,
    linkedin:    549,
    coverLetter: 0,
    portfolio:   7999,
  },
  EXECUTIVE: {
    resume:      1299,
    linkedin:    899,
    coverLetter: 0,
    portfolio:   14999,
  },
  EXECUTIVE_PLUS: {
    resume:      1999,
    linkedin:    1299,
    coverLetter: 0,
    portfolio:   14999,
  },
  AGENCY_CLIENT: {
    resume:      0,
    linkedin:    0,
    coverLetter: 0,
    portfolio:   0,
  },
};

// ─────────────────────────────────────────────
// REVISION FEE (INR) — charged after 2 free revisions
// ─────────────────────────────────────────────
export const REVISION_FEE: Record<ClientType, number> = {
  FRESHER:        149,
  MID_CAREER:     249,
  EXECUTIVE:      349,
  EXECUTIVE_PLUS: 499,
  AGENCY_CLIENT:  0,
};

// ─────────────────────────────────────────────
// CLIENT TYPE DISPLAY NAMES
// ─────────────────────────────────────────────
export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  FRESHER:        'Fresher',
  MID_CAREER:     'Mid-Career Professional',
  EXECUTIVE:      'Executive',
  EXECUTIVE_PLUS: 'Executive Plus',
  AGENCY_CLIENT:  'Agency Client',
};

// ─────────────────────────────────────────────
// SERVICE DESCRIPTIONS BY CLIENT TYPE
// ─────────────────────────────────────────────
export const SERVICE_DESCRIPTIONS: Record<ClientType, {
  resume: string;
  linkedin: string;
  coverLetter: string;
  portfolio: string;
  executiveConnect: string;
  executiveConnectPlus: string;
}> = {
  FRESHER: {
    resume:
      'ATS-optimized resume tailored to entry-level roles — highlights academic achievements, internships, and transferable skills to get you past the bots and onto the shortlist.',
    linkedin:
      'LinkedIn profile overhaul focused on building recruiter visibility, keyword optimization for your target industry, and a headline that gets noticed.',
    coverLetter:
      'Professionally crafted cover letter template — customizable for each application, showcasing your potential and motivation.',
    portfolio:
      'Personal portfolio website showcasing education, academic/industry projects, and technical skill credentials.',
    executiveConnect:
      '1-on-1 career coaching and interview preparation consultation.',
    executiveConnectPlus:
      'Comprehensive career roadmap & interview strategy session.',
  },
  MID_CAREER: {
    resume:
      'Impact-driven resume that quantifies your achievements and progression — designed to position you competitively for the next step in your career trajectory.',
    linkedin:
      'Strategic LinkedIn transformation emphasizing career growth, measurable outcomes, and personal brand to attract senior roles and executive headhunters.',
    coverLetter:
      'Compelling cover letter that bridges your experience to your target role, demonstrating value with concrete examples.',
    portfolio:
      'Professional portfolio website featuring selected case studies, measurable outcomes, and project deliverables.',
    executiveConnect:
      'Mid-career strategy consultation and compensation negotiation blueprint.',
    executiveConnectPlus:
      'Multi-session career trajectory guidance & executive search positioning.',
  },
  EXECUTIVE: {
    resume:
      'Executive-grade resume that communicates leadership, P&L ownership, and strategic business outcomes — crafted to open doors at VP and C-suite levels.',
    linkedin:
      'High-authority LinkedIn presence built for thought leadership — positioning you as an industry expert that executive search firms compete to place.',
    coverLetter:
      'Board-ready cover letter articulating your strategic vision, leadership philosophy, and transformative impact.',
    portfolio:
      'Executive bio & media portfolio website highlighting enterprise exits, scale, key milestones, and board readiness.',
    executiveConnect:
      '1-on-1 strategic executive positioning and board advisory consultation.',
    executiveConnectPlus:
      'Executive Connect Plus: Comprehensive executive advisory, board positioning, and leadership roadmap.',
  },
  EXECUTIVE_PLUS: {
    resume:
      'Premium executive biography and résumé suite — multi-format package for board applications, media profiles, and top-tier executive search, telling your leadership story at scale.',
    linkedin:
      'Full LinkedIn brand architecture — complete profile, Featured section, About narrative, and ongoing optimization strategy for maximum C-suite and board visibility.',
    coverLetter:
      'Bespoke cover letter for each target organization — researched, personalized, and positioning you as the definitive strategic hire.',
    portfolio:
      'White-glove executive brand hub with custom domain, private credentials, board case studies, and press citations.',
    executiveConnect:
      'Bespoke C-Suite advisory & private board candidacy positioning.',
    executiveConnectPlus:
      'Executive Connect Plus: Full advisory partnership covering board appointments, investor narrative, and C-suite succession.',
  },
  AGENCY_CLIENT: {
    resume: 'Custom Ripple Nexus Services',
    linkedin: 'Custom Ripple Nexus LinkedIn Solutions',
    coverLetter: 'Custom Ripple Nexus Professional Correspondence',
    portfolio: 'Enterprise Digital Showcase & Brand Hub',
    executiveConnect: 'Strategic Business & Advisory Consultation',
    executiveConnectPlus: 'Enterprise Advisory Partnership',
  },
};

export function getServiceDescription(serviceIdentifier: string, clientType: ClientType): string {
  const descriptions = SERVICE_DESCRIPTIONS[clientType] ?? SERVICE_DESCRIPTIONS.MID_CAREER;
  const normalized = serviceIdentifier.toUpperCase().replace(/[\s-]+/g, '_');
  if (normalized.includes('EXECUTIVE_CONNECT_PLUS')) return descriptions.executiveConnectPlus;
  if (normalized.includes('EXECUTIVE_CONNECT') || normalized.includes('STRATEGY_CONSULTATION')) return descriptions.executiveConnect;
  if (normalized.includes('RESUME')) return descriptions.resume;
  if (normalized.includes('LINKEDIN')) return descriptions.linkedin;
  if (normalized.includes('COVER_LETTER') || normalized.includes('COVER')) return descriptions.coverLetter;
  if (normalized.includes('PORTFOLIO')) return descriptions.portfolio;
  return '';
}

// ─────────────────────────────────────────────
// FEE RATES (BLENDED ZERO-LOSS RATES)
// ─────────────────────────────────────────────
export const FEE_RATES = {
  RAZORPAY_DOMESTIC: 0.0295, // 2.5% Gateway Fee + 18% GST (2.5 * 1.18)
  RAZORPAY_INTL:     0.0554, // 3.54% Gateway Fee + ~2.00% FX spread
  PAYPAL_INTL:       0.090,  // 5.19% Gateway Fee + ~3.81% FX spread
  BANK_TRANSFER_NATIVE: 0.0118, // 1% + 18% GST
  BANK_TRANSFER_SWIFT:  0.0354, // 3% + 18% GST
};

// ─────────────────────────────────────────────
// PRICING CALCULATOR
// ─────────────────────────────────────────────
export function calculatePricing(
  clientType: ClientType,
  currency: string,
  exchangeRate: number,
  services: { resume: boolean; linkedin: boolean; coverLetter: boolean; portfolio?: boolean },
  customBaseInr?: { resume?: number; linkedin?: number; portfolio?: number },
  paymentGateway: 'RAZORPAY' | 'PAYPAL' = 'RAZORPAY'
): PricingCalculation {
  const base = BASE_PRICING[clientType];

  // Allow custom override pricing (for edits)
  const resumeBaseInr    = services.resume   ? (customBaseInr?.resume   ?? base.resume)   : 0;
  const linkedinBaseInr  = services.linkedin ? (customBaseInr?.linkedin ?? base.linkedin) : 0;
  const portfolioBaseInr = services.portfolio ? (customBaseInr?.portfolio ?? base.portfolio) : 0;
  const coverLetterBaseInr = 0;

  const subtotalInr = resumeBaseInr + linkedinBaseInr + coverLetterBaseInr + portfolioBaseInr;

  const resumeConverted        = round2(resumeBaseInr    / exchangeRate);
  const linkedinConverted      = round2(linkedinBaseInr  / exchangeRate);
  const portfolioConverted     = round2(portfolioBaseInr / exchangeRate);
  const coverLetterConverted   = 0;
  const subtotalConverted      = round2(subtotalInr      / exchangeRate); // This is our target Net

  const processingFeeRate = currency === 'INR' 
    ? FEE_RATES.RAZORPAY_DOMESTIC 
    : (paymentGateway === 'PAYPAL' ? FEE_RATES.PAYPAL_INTL : FEE_RATES.RAZORPAY_INTL);

  // ZERO-LOSS GROSS-UP FORMULA: GrossPayable = Net / (1 - Rate)
  const totalPayable           = round2(subtotalConverted / (1 - processingFeeRate));
  const processingFeeConverted = round2(totalPayable - subtotalConverted);

  return {
    resumeBaseInr,
    linkedinBaseInr,
    coverLetterBaseInr,
    portfolioBaseInr,
    resumeConverted,
    linkedinConverted,
    coverLetterConverted,
    portfolioConverted,
    subtotalInr,
    subtotalConverted,
    processingFeeRate,
    processingFeeConverted,
    totalPayable,
    exchangeRate,
  };
}

// ─────────────────────────────────────────────
// INVOICE NUMBER GENERATOR
// ─────────────────────────────────────────────
export function generateInvoiceNumber(): string {
  const now    = new Date();
  const year   = now.getFullYear().toString().slice(-2);
  const month  = String(now.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `RN-${year}${month}-${random}`;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatCurrency(amount: number, symbol: string): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (!symbol) return isNegative ? `-${formatted}` : formatted;
  const trimmed = symbol.trim();
  // Standard international financial typography:
  // Multi-character or alphabetical symbols (e.g. RM, AED, SAR, SGD, CAD, AUD, CHF, kr, zł, QR)
  // require a space so letters don't blend into digits: "RM 750.00", "AED 1,500.00"
  // Single typographic glyphs (e.g. ₹, $, £, €) stay attached: "₹750.00", "$750.00"
  const needsSpace = /[A-Za-z]/.test(trimmed) || trimmed.length > 1;
  const symPart = `${trimmed}${needsSpace ? ' ' : ''}`;
  return isNegative ? `-${symPart}${formatted}` : `${symPart}${formatted}`;
}

export function toSmallestUnit(amount: number, currency: string): number {
  // Zero-decimal currencies — no subunit (Razorpay & Stripe both expect whole number)
  const zeroDecimal = ['JPY', 'KRW', 'VND', 'IDR', 'CLP', 'TWD', 'HUF', 'UGX', 'RWF', 'XAF', 'XOF', 'ISK', 'PYG', 'VUV', 'XPF', 'DJF', 'GNF', 'KMF', 'BIF', 'MGA'];
  if (zeroDecimal.includes(currency)) return Math.round(amount);
  // 3-decimal currencies (Gulf) — smallest unit is 1/1000 (fils/baisa)
  const threeDecimal = ['KWD', 'BHD', 'OMR', 'JOD', 'TND', 'LYD'];
  if (threeDecimal.includes(currency)) return Math.round(amount * 1000);
  // Default: 2-decimal (paise, cents, pence, fils for AED/SAR/QAR, etc.)
  return Math.round(amount * 100);
}
