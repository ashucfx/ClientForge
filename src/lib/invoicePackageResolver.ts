// src/lib/invoicePackageResolver.ts
// Intelligent Package & Service Classification Engine for Catalyst Talent Positioning Architecture

export interface PackageDetails {
  packageName: string;
  trackName: string;
  slaDays: string;
  isCustom: boolean;
  serviceCount: number;
}

export interface SimplifiedLineItem {
  description: string;
  qty?: number;
  unitPrice?: number;
  lineTotal?: number;
}

/**
 * Intelligent package and service classification engine.
 * Accurately detects:
 * - Single-service purchases (Resume only, LinkedIn only, Cover Letter only, Portfolio only, Executive Connect only)
 * - Dual-service combinations (Resume + LinkedIn, Resume + Cover Letter, etc.)
 * - Complete Career Booster Package (Resume + LinkedIn + Cover Letter)
 * - Premium Plus Package (4+ services or Portfolio Website included)
 * - Respects explicit clientType/notes while never mislabeling single services as full packages.
 */
export function resolveInvoicePackage(
  clientType?: string | null,
  notes?: string | null,
  lineItems: SimplifiedLineItem[] = []
): PackageDetails {
  const items = Array.isArray(lineItems) ? lineItems : [];
  const descs = items.map(i => (i.description || '').toLowerCase());
  const combinedContext = `${clientType || ''} ${notes || ''} ${descs.join(' ')}`.toLowerCase();

  const hasResume = descs.some(d => /resume|cv\b/i.test(d)) || /resume|cv\b/i.test(combinedContext);
  const hasLinkedin = descs.some(d => /linkedin/i.test(d)) || /linkedin/i.test(combinedContext);
  const hasCoverLetter = descs.some(d => /cover.?letter/i.test(d)) || /cover.?letter/i.test(combinedContext);
  const hasPortfolio = descs.some(d => /portfolio|website/i.test(d)) || /portfolio|website/i.test(combinedContext);
  const hasExecutiveConnect = descs.some(d => /executive.?connect|consultation|advisory/i.test(d));

  // Count distinct core services present
  let distinctCoreCount = 0;
  if (hasResume) distinctCoreCount++;
  if (hasLinkedin) distinctCoreCount++;
  if (hasCoverLetter) distinctCoreCount++;
  if (hasPortfolio) distinctCoreCount++;
  if (hasExecutiveConnect) distinctCoreCount++;

  const effectiveCount = Math.max(items.length, distinctCoreCount);

  // ── CASE 1: Premium Plus Package (4+ items or contains Portfolio Website / Executive Plus) ──
  const isExplicitPremiumPlus =
    combinedContext.includes('executive_plus') ||
    combinedContext.includes('premium plus') ||
    combinedContext.includes('exec+') ||
    combinedContext.includes('plus package');

  if (isExplicitPremiumPlus || hasPortfolio || effectiveCount >= 4) {
    return {
      packageName: 'Premium Plus Package',
      trackName: '— Executive C-Suite & Global Talent Positioning Architecture',
      slaDays: 'SLA: 7–10 BIZ DAYS',
      isCustom: false,
      serviceCount: effectiveCount,
    };
  }

  // ── CASE 2: Career Booster Package (All 3 core services: Resume + LinkedIn + Cover Letter) ──
  const hasAllThreeCore = hasResume && hasLinkedin && hasCoverLetter;
  const isExplicitCareerBooster =
    combinedContext.includes('career booster') ||
    combinedContext.includes('full package') ||
    (combinedContext.includes('full') && effectiveCount >= 3);

  if ((hasAllThreeCore && effectiveCount >= 3) || (isExplicitCareerBooster && effectiveCount >= 3)) {
    return {
      packageName: 'Career Booster Package',
      trackName: '— Accelerated Career Positioning Architecture',
      slaDays: 'SLA: 7–10 BIZ DAYS',
      isCustom: false,
      serviceCount: effectiveCount,
    };
  }

  // ── CASE 3: Single Service Standalone Purchases (Strictly 1 item or 1 core service) ──
  if (effectiveCount === 1 || items.length === 1) {
    const singleDesc = (items[0]?.description || '').trim();

    if (hasResume) {
      return {
        packageName: 'Professional Resume Writing',
        trackName: '— Bespoke Executive Career Asset Formulation',
        slaDays: 'SLA: 3–5 BIZ DAYS',
        isCustom: false,
        serviceCount: 1,
      };
    }
    if (hasLinkedin) {
      return {
        packageName: 'LinkedIn Profile Optimisation & Personal Branding',
        trackName: '— Executive Presence & Algorithm Positioning Architecture',
        slaDays: 'SLA: 3–5 BIZ DAYS',
        isCustom: false,
        serviceCount: 1,
      };
    }
    if (hasCoverLetter) {
      return {
        packageName: 'Strategic Executive Cover Letter Writing',
        trackName: '— High-Impact Narrative & Target Pitch Architecture',
        slaDays: 'SLA: 2–3 BIZ DAYS',
        isCustom: false,
        serviceCount: 1,
      };
    }
    if (hasExecutiveConnect) {
      return {
        packageName: 'Executive Connect Strategy Consultation',
        trackName: '— 1-on-1 Strategic Career Advisory & Roadmap Alignment',
        slaDays: 'SLA: 1–2 BIZ DAYS',
        isCustom: false,
        serviceCount: 1,
      };
    }

    // Generic single service fallback
    const cleanTitle = singleDesc ? singleDesc.replace(/\s*\([^)]*\)/g, '').trim() : 'Specialized Career Architecture';
    return {
      packageName: cleanTitle,
      trackName: '— Specialized Talent Architecture Engagement',
      slaDays: 'SLA: 3–5 BIZ DAYS',
      isCustom: true,
      serviceCount: 1,
    };
  }

  // ── CASE 4: Dual Service Combinations (2 services) ──
  if (hasResume && hasLinkedin) {
    return {
      packageName: 'Resume & LinkedIn Alignment Track',
      trackName: '— Dual-Asset Career Repositioning Architecture',
      slaDays: 'SLA: 5–7 BIZ DAYS',
      isCustom: false,
      serviceCount: 2,
    };
  }

  if (hasResume && hasCoverLetter) {
    return {
      packageName: 'Resume & Strategic Cover Letter Track',
      trackName: '— Targeted Executive Application Architecture',
      slaDays: 'SLA: 5–7 BIZ DAYS',
      isCustom: false,
      serviceCount: 2,
    };
  }

  if (hasLinkedin && hasCoverLetter) {
    return {
      packageName: 'LinkedIn & Outreach Positioning Track',
      trackName: '— Executive Outreach & Personal Branding Architecture',
      slaDays: 'SLA: 5–7 BIZ DAYS',
      isCustom: false,
      serviceCount: 2,
    };
  }

  // ── CASE 5: Custom Multi-Service Engagement ──
  const serviceLabels: string[] = [];
  if (hasResume) serviceLabels.push('Resume');
  if (hasLinkedin) serviceLabels.push('LinkedIn');
  if (hasCoverLetter) serviceLabels.push('Cover Letter');
  if (hasExecutiveConnect) serviceLabels.push('Consultation');

  const comboTitle = serviceLabels.length > 0 ? `${serviceLabels.join(' + ')} Track` : 'Custom Career Architecture Engagement';

  return {
    packageName: comboTitle,
    trackName: '— Multi-Asset Talent Positioning Architecture',
    slaDays: effectiveCount <= 2 ? 'SLA: 5–7 BIZ DAYS' : 'SLA: 7–10 BIZ DAYS',
    isCustom: true,
    serviceCount: effectiveCount,
  };
}
