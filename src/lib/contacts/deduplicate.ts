import { db } from '@/lib/db/db';

interface DeduplicateInput {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  companyName?: string | null;
}

export interface DeduplicateResult {
  action: 'AUTO_LINK' | 'MANUAL_REVIEW' | 'CREATE_NEW';
  targetContactId?: string;
  confidenceScore?: number;
  reason?: string;
}

export async function determineContactIdentity(input: DeduplicateInput): Promise<DeduplicateResult> {
  const orConditions: any[] = [];
  if (input.email) orConditions.push({ email: input.email });
  if (input.phone) orConditions.push({ phone: input.phone });
  if (input.name) orConditions.push({ name: input.name });

  if (orConditions.length === 0) {
    return { action: 'CREATE_NEW' };
  }

  // Fetch potential matches
  const candidates = await db.contact.findMany({
    where: {
      OR: orConditions,
      status: 'ACTIVE' // Only match against active contacts, not merged ones
    }
  });

  if (candidates.length === 0) {
    return { action: 'CREATE_NEW' };
  }

  let bestMatch = null;
  let highestScore = 0;
  let bestReason = '';

  for (const candidate of candidates) {
    let score = 0;
    const matches = [];

    // Exact Email match (+70)
    if (input.email && candidate.email && input.email.toLowerCase() === candidate.email.toLowerCase()) {
      score += 70;
      matches.push('Email');
    }

    // Exact Phone match (+25)
    if (input.phone && candidate.phone && input.phone.replace(/\D/g, '') === candidate.phone.replace(/\D/g, '')) {
      score += 25;
      matches.push('Phone');
    }

    // Exact Name match (+5)
    if (input.name && candidate.name && input.name.toLowerCase().trim() === candidate.name.toLowerCase().trim()) {
      score += 5;
      matches.push('Name');
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = candidate;
      bestReason = `Matched on: ${matches.join(', ')}`;
    }
  }

  if (!bestMatch || highestScore < 30) {
    return { action: 'CREATE_NEW' };
  }

  if (highestScore >= 75) {
    return { 
      action: 'AUTO_LINK', 
      targetContactId: bestMatch.id,
      confidenceScore: highestScore,
      reason: bestReason
    };
  }

  // 30 to 74 is manual review
  return {
    action: 'MANUAL_REVIEW',
    targetContactId: bestMatch.id,
    confidenceScore: highestScore,
    reason: bestReason
  };
}
