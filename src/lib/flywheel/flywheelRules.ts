// Typed configuration for Flywheel Opportunity & Risk Rules

export type ActionType = 'UPSELL' | 'REFERRAL' | 'REVIEW' | 'RISK' | 'RETENTION';

export interface FlywheelRule {
  id: string;
  name: string;
  type: ActionType;
  trigger: 'DAILY_CRON' | 'ON_EVENT';
  evaluate: (contact: any) => Promise<RuleResult | null>;
}

export interface RuleResult {
  title: string;
  reason: string;
  confidence: number;
  revenuePotential: number;
  suggestedAction: string;
  actionData?: any;
  priority: number;
}

// ─── THE RULES ───

export const UPSELL_PORTFOLIO_RULE: FlywheelRule = {
  id: 'UPSELL_PORTFOLIO_14_DAY',
  name: 'Portfolio Upsell (Post-Resume)',
  type: 'UPSELL',
  trigger: 'DAILY_CRON',
  evaluate: async (contact: any) => {
    const hasResume = contact.careerClients?.some((c: any) =>
      c.services?.some((s: any) => s.service?.slug === 'RESUME') &&
      c.status === 'COMPLETED'
    );
    const hasPortfolio = contact.careerClients?.some((c: any) =>
      c.services?.some((s: any) => s.service?.slug === 'PORTFOLIO')
    );

    if (hasResume && !hasPortfolio) {
      const resumeProject = contact.careerClients.find((c: any) => c.status === 'COMPLETED');
      if (!resumeProject || !resumeProject.completedAt) return null;

      const daysSince = (Date.now() - new Date(resumeProject.completedAt).getTime()) / (1000 * 3600 * 24);

      if (daysSince >= 14 && daysSince <= 45) {
        // Estimate revenue potential in client's currency (base: ₹15,000 or $180 for intl)
        const isIntl = contact.flywheelProfile?.currency && contact.flywheelProfile.currency !== 'INR';
        return {
          title: 'Offer Portfolio Website',
          reason: `Resume was completed ${Math.floor(daysSince)} days ago. High probability of needing a portfolio.`,
          confidence: 85,
          revenuePotential: isIntl ? 180 : 15000,
          suggestedAction: 'SEND_TEMPLATE_PORTFOLIO_UPSELL',
          actionData: { templateId: 'portfolio_upsell' },
          priority: 80,
        };
      }
    }
    return null;
  },
};

export const REQUEST_REFERRAL_RULE: FlywheelRule = {
  id: 'REFERRAL_POST_5_STAR',
  name: 'Referral Request (Post 5-Star Review)',
  type: 'REFERRAL',
  trigger: 'DAILY_CRON',
  evaluate: async (contact: any) => {
    const profile = contact.flywheelProfile;
    if (!profile) return null;

    // Check for an actual 5-star review from this contact
    const hasFiveStarReview = contact.reviews?.some(
      (r: any) => r.rating === 5 && r.isPublished !== false
    );

    // Also accept high NPS (promoter) as signal when no review yet
    const isPromoter = contact.feedbacks?.some((f: any) => f.npsScore >= 9);

    if (!hasFiveStarReview && !isPromoter) return null;

    // Only fire once: check engagementScore as recency proxy (boosted by recent activity)
    if (profile.engagementScore < 20) return null;

    return {
      title: 'Request Referral',
      reason: hasFiveStarReview
        ? 'Client left a 5-star review — ideal moment to ask for a referral.'
        : 'Client is an NPS promoter (score ≥ 9) with high engagement.',
      confidence: hasFiveStarReview ? 92 : 75,
      revenuePotential: 0,
      suggestedAction: 'SEND_TEMPLATE_REFERRAL_ASK',
      actionData: { templateId: 'referral_ask' },
      priority: 70,
    };
  },
};

export const GHOSTING_RISK_RULE: FlywheelRule = {
  id: 'RISK_GHOSTING_7_DAY',
  name: 'Ghosting Risk',
  type: 'RISK',
  trigger: 'DAILY_CRON',
  evaluate: async (contact: any) => {
    const activeProjects = contact.careerClients?.filter(
      (c: any) => c.status === 'UNDER_PROCESS' || c.status === 'DRAFT_SENT'
    );
    if (!activeProjects?.length) return null;

    for (const project of activeProjects) {
      if (project.waitingOn !== 'CLIENT') continue;

      // Use lastClientResponseAt if available (explicit client activity timestamp),
      // fall back to the most recent message timestamp, then updatedAt as last resort
      const lastActivity =
        project.lastClientResponseAt ??
        project.messages?.reduce((latest: Date | null, m: any) => {
          if (m.senderType !== 'CLIENT') return latest;
          const t = new Date(m.createdAt);
          return !latest || t > latest ? t : latest;
        }, null) ??
        project.updatedAt;

      if (!lastActivity) continue;

      const daysWaiting = (Date.now() - new Date(lastActivity).getTime()) / (1000 * 3600 * 24);
      if (daysWaiting >= 7) {
        return {
          title: 'SLA Risk: Client Ghosting',
          reason: `Waiting on client for ${Math.floor(daysWaiting)} days — no client activity detected.`,
          confidence: 100,
          revenuePotential: 0,
          suggestedAction: 'SEND_MANUAL_FOLLOWUP',
          priority: 100,
        };
      }
    }
    return null;
  },
};

export const ACTIVE_RULES = [
  UPSELL_PORTFOLIO_RULE,
  REQUEST_REFERRAL_RULE,
  GHOSTING_RISK_RULE,
];
