/**
 * Auto-qualification scoring engine for /inquire leads.
 * Computes a 0-100 score to help admins prioritize leads.
 *
 * Score breakdown:
 *   Requirement type:     0-30 points
 *   Services requested:   0-25 points
 *   Country (market):     0-20 points
 *   Requirement notes:    0-15 points
 *   Contact completeness: 0-10 points
 */

// ── Requirement type weights ──
const REQUIREMENT_SCORES: Record<string, number> = {
  EXECUTIVE_RESUME: 30,
  RETAINER: 28,
  AGENCY: 25,
  CUSTOM_DEV: 22,
  CONSULTING: 20,
  OTHER: 10,
};

// ── High-value market countries ──
const HIGH_VALUE_COUNTRIES: Record<string, number> = {
  US: 20,
  GB: 18,
  AE: 18,
  SG: 16,
  AU: 16,
  CA: 15,
  DE: 14,
  CH: 14,
  NL: 13,
  SE: 12,
  IN: 10,
};

export interface QualificationInput {
  requirementType: string;
  servicesRequested: string[];
  countryCode: string;
  requirementNotes?: string | null;
  phone?: string | null;
  email: string;
  name: string;
}

export function computeAutoQualScore(input: QualificationInput): number {
  let score = 0;

  // 1. Requirement type (0-30)
  score += REQUIREMENT_SCORES[input.requirementType] ?? 5;

  // 2. Services requested (0-25)
  const serviceCount = input.servicesRequested?.length ?? 0;
  if (serviceCount >= 4) score += 25;
  else if (serviceCount === 3) score += 20;
  else if (serviceCount === 2) score += 15;
  else if (serviceCount === 1) score += 10;

  // 3. Country / market value (0-20)
  const countryUpper = input.countryCode?.toUpperCase() ?? '';
  score += HIGH_VALUE_COUNTRIES[countryUpper] ?? 8;

  // 4. Requirement notes quality (0-15)
  const notesLength = input.requirementNotes?.trim().length ?? 0;
  if (notesLength > 200) score += 15;
  else if (notesLength > 100) score += 12;
  else if (notesLength > 50) score += 8;
  else if (notesLength > 10) score += 4;

  // 5. Contact completeness (0-10)
  if (input.name?.trim()) score += 3;
  if (input.email?.trim()) score += 3;
  if (input.phone?.trim()) score += 4;

  return Math.min(100, Math.max(0, score));
}

/**
 * Derive priority from auto-qual score.
 */
export function scoreToPriority(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' {
  if (score >= 80) return 'URGENT';
  if (score >= 60) return 'HIGH';
  if (score >= 35) return 'MEDIUM';
  return 'LOW';
}
