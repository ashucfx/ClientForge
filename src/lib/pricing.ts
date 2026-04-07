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
  },
  MID_CAREER: {
    resume:      799,
    linkedin:    549,
    coverLetter: 0,
  },
  EXECUTIVE: {
    resume:      1299,
    linkedin:    899,
    coverLetter: 0,
  },
  EXECUTIVE_PLUS: {
    resume:      1999,
    linkedin:    1299,
    coverLetter: 0,
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
};

// ─────────────────────────────────────────────
// CLIENT TYPE DISPLAY NAMES
// ─────────────────────────────────────────────
export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  FRESHER:        'Fresher',
  MID_CAREER:     'Mid-Career Professional',
  EXECUTIVE:      'Executive',
  EXECUTIVE_PLUS: 'Executive Plus',
};

// ─────────────────────────────────────────────
// SERVICE DESCRIPTIONS BY CLIENT TYPE
// ─────────────────────────────────────────────
export const SERVICE_DESCRIPTIONS: Record<ClientType, {
  resume: string;
  linkedin: string;
  coverLetter: string;
}> = {
  FRESHER: {
    resume:
      'ATS-optimized resume tailored to entry-level roles — highlights academic achievements, internships, and transferable skills to get you past the bots and onto the shortlist.',
    linkedin:
      'LinkedIn profile overhaul focused on building recruiter visibility, keyword optimization for your target industry, and a headline that gets noticed.',
    coverLetter:
      'Professionally crafted cover letter template — customizable for each application, showcasing your potential and motivation.',
  },
  MID_CAREER: {
    resume:
      'Impact-driven resume that quantifies your achievements and progression — designed to position you competitively for the next step in your career trajectory.',
    linkedin:
      'Strategic LinkedIn transformation emphasizing career growth, measurable outcomes, and personal brand to attract senior roles and executive headhunters.',
    coverLetter:
      'Compelling cover letter that bridges your experience to your target role, demonstrating value with concrete examples.',
  },
  EXECUTIVE: {
    resume:
      'Executive-grade resume that communicates leadership, P&L ownership, and strategic business outcomes — crafted to open doors at VP and C-suite levels.',
    linkedin:
      'High-authority LinkedIn presence built for thought leadership — positioning you as an industry expert that executive search firms compete to place.',
    coverLetter:
      'Board-ready cover letter articulating your strategic vision, leadership philosophy, and transformative impact.',
  },
  EXECUTIVE_PLUS: {
    resume:
      'Premium executive biography and résumé suite — multi-format package for board applications, media profiles, and top-tier executive search, telling your leadership story at scale.',
    linkedin:
      'Full LinkedIn brand architecture — complete profile, Featured section, About narrative, and ongoing optimization strategy for maximum C-suite and board visibility.',
    coverLetter:
      'Bespoke cover letter for each target organization — researched, personalized, and positioning you as the definitive strategic hire.',
  },
};

// ─────────────────────────────────────────────
// FEE RATES
// ─────────────────────────────────────────────
export const FEE_RATES = {
  INR:           0.02,   // 2% domestic
  INTERNATIONAL: 0.035,  // 3.5% international
};

// ─────────────────────────────────────────────
// PRICING CALCULATOR
// ─────────────────────────────────────────────
export function calculatePricing(
  clientType: ClientType,
  currency: string,
  exchangeRate: number,
  services: { resume: boolean; linkedin: boolean; coverLetter: boolean },
  customBaseInr?: { resume?: number; linkedin?: number }
): PricingCalculation {
  const base = BASE_PRICING[clientType];

  // Allow custom override pricing (for edits)
  const resumeBaseInr    = services.resume   ? (customBaseInr?.resume   ?? base.resume)   : 0;
  const linkedinBaseInr  = services.linkedin ? (customBaseInr?.linkedin ?? base.linkedin) : 0;
  const coverLetterBaseInr = 0;

  const subtotalInr = resumeBaseInr + linkedinBaseInr + coverLetterBaseInr;

  const resumeConverted        = round2(resumeBaseInr    / exchangeRate);
  const linkedinConverted      = round2(linkedinBaseInr  / exchangeRate);
  const coverLetterConverted   = 0;
  const subtotalConverted      = round2(subtotalInr      / exchangeRate);

  const processingFeeRate      = currency === 'INR' ? FEE_RATES.INR : FEE_RATES.INTERNATIONAL;
  const processingFeeConverted = round2(subtotalConverted * processingFeeRate);
  const totalPayable           = round2(subtotalConverted + processingFeeConverted);

  return {
    resumeBaseInr,
    linkedinBaseInr,
    coverLetterBaseInr,
    resumeConverted,
    linkedinConverted,
    coverLetterConverted,
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
  return `${symbol}${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function toSmallestUnit(amount: number, currency: string): number {
  const zeroDecimal = ['JPY', 'KRW', 'VND', 'IDR', 'CLP'];
  if (zeroDecimal.includes(currency)) return Math.round(amount);
  return Math.round(amount * 100);
}
