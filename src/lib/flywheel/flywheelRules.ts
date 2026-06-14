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
    // Look for CareerClients who got a Resume delivered > 14 days ago, and don't have a Portfolio.
    const hasResume = contact.careerClients?.some((c: any) => 
      c.services?.some((s: any) => s.service?.slug === 'RESUME') && 
      c.status === 'COMPLETED'
    );
    const hasPortfolio = contact.careerClients?.some((c: any) => 
      c.services?.some((s: any) => s.service?.slug === 'PORTFOLIO')
    );

    if (hasResume && !hasPortfolio) {
      // Find the completion date
      const resumeProject = contact.careerClients.find((c: any) => c.status === 'COMPLETED');
      if (!resumeProject || !resumeProject.completedAt) return null;

      const daysSince = (new Date().getTime() - new Date(resumeProject.completedAt).getTime()) / (1000 * 3600 * 24);
      
      if (daysSince >= 14 && daysSince <= 45) {
        return {
          title: 'Offer Portfolio Website',
          reason: `Resume was completed ${Math.floor(daysSince)} days ago. High probability of needing a portfolio.`,
          confidence: 85,
          revenuePotential: 15000,
          suggestedAction: 'SEND_TEMPLATE_PORTFOLIO_UPSELL',
          actionData: { templateId: 'portfolio_upsell' },
          priority: 80
        };
      }
    }
    return null;
  }
};

export const REQUEST_REFERRAL_RULE: FlywheelRule = {
  id: 'REFERRAL_POST_5_STAR',
  name: 'Referral Request (Post 5-Star Review)',
  type: 'REFERRAL',
  trigger: 'DAILY_CRON',
  evaluate: async (contact: any) => {
    // If they have a 5 star review and high engagement
    const profile = contact.flywheelProfile;
    if (!profile) return null;

    // Fake logic for the review part since Reviews is a separate table, 
    // but assume we know engagementScore went up heavily.
    if (profile.engagementScore > 50) {
      return {
        title: 'Request Referral',
        reason: 'Client has extremely high engagement score. Perfect time to ask for a referral.',
        confidence: 90,
        revenuePotential: 0,
        suggestedAction: 'SEND_TEMPLATE_REFERRAL_ASK',
        actionData: { templateId: 'referral_ask' },
        priority: 70
      };
    }
    return null;
  }
};

export const GHOSTING_RISK_RULE: FlywheelRule = {
  id: 'RISK_GHOSTING_7_DAY',
  name: 'Ghosting Risk',
  type: 'RISK',
  trigger: 'DAILY_CRON',
  evaluate: async (contact: any) => {
    const activeProjects = contact.careerClients?.filter((c: any) => c.status === 'UNDER_PROCESS' || c.status === 'DRAFT_SENT');
    if (!activeProjects?.length) return null;

    for (const project of activeProjects) {
      if (project.waitingOn === 'CLIENT' && project.updatedAt) {
        const daysWaiting = (new Date().getTime() - new Date(project.updatedAt).getTime()) / (1000 * 3600 * 24);
        if (daysWaiting >= 7) {
          return {
            title: 'SLA Risk: Client Ghosting',
            reason: `Waiting on client for ${Math.floor(daysWaiting)} days on project ${project.id}.`,
            confidence: 100,
            revenuePotential: 0,
            suggestedAction: 'SEND_MANUAL_FOLLOWUP',
            priority: 100 // High priority
          };
        }
      }
    }
    return null;
  }
};

export const ACTIVE_RULES = [
  UPSELL_PORTFOLIO_RULE,
  REQUEST_REFERRAL_RULE,
  GHOSTING_RISK_RULE
];
