import { describe, it, expect } from 'vitest';
import {
  CURRENT_SLA_VERSION,
  SLA_AGREEMENT_SECTIONS,
  computeAgreementChecksum,
} from '../agreements/slaTerms';
import { convertForeignToInr } from '../currency';

describe('SLA Agreement Engine', () => {
  it('defines valid agreement terms and version', () => {
    expect(CURRENT_SLA_VERSION).toBe('CATALYST-SLA-V2026.1');
    expect(SLA_AGREEMENT_SECTIONS.length).toBeGreaterThanOrEqual(6);
    expect(SLA_AGREEMENT_SECTIONS[1].title).toContain('Turnaround Times');
  });

  it('computes deterministic SHA-256 agreement checksums', () => {
    const sum1 = computeAgreementChecksum({
      email: 'client@example.com',
      version: 'CATALYST-SLA-V2026.1',
      timestamp: '2026-09-30T10:00:00.000Z',
      ipAddress: '103.21.244.1',
    });
    const sum2 = computeAgreementChecksum({
      email: 'CLIENT@EXAMPLE.COM ',
      version: 'CATALYST-SLA-V2026.1',
      timestamp: '2026-09-30T10:00:00.000Z',
      ipAddress: '103.21.244.1',
    });
    expect(sum1).toBe(sum2);
    expect(sum1).toHaveLength(64);
  });
});

describe('Currency and Tax Invoicing', () => {
  it('converts multi-currency invoices accurately to INR', () => {
    // Foreign currency billed in USD at 0.012 -> INR approx 8333
    expect(convertForeignToInr(250, 'USD', 0.012)).toBe(20833);
    // Foreign currency billed in AED at 0.044 -> INR approx 2273
    expect(convertForeignToInr(100, 'AED', 0.044)).toBe(2273);
  });
});
