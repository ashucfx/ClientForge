// src/lib/career/revisionWindow.ts
// Standardized revision window calculation for Catalyst Career Services:
// 1. Draft Stage: 14 calendar days from draft deliverable upload/delivery.
// 2. Final Delivery Stage: 7 calendar days from project completion (status === 'COMPLETED').
// 3. Post-Window: Free revisions strictly prohibited; button converts to "Request Paid Revision".

export interface RevisionWindowInfo {
  stage: 'NOT_DELIVERED' | 'DRAFT' | 'FINAL_DELIVERY' | 'EXPIRED';
  windowDays: number;
  daysSince: number;
  daysRemaining: number;
  isExpired: boolean;
  statusLabel: string;
  badgeColor: 'emerald' | 'amber' | 'red' | 'slate';
  reason?: string;
}

export const DRAFT_WINDOW_DAYS = 14;
export const FINAL_DELIVERY_WINDOW_DAYS = 7;

/**
 * Calculates the exact revision window for a client and deliverable.
 */
export function calculateRevisionWindow(params: {
  status: string;
  draftSentAt?: string | Date | null;
  completedAt?: string | Date | null;
  firstCompletedAt?: string | Date | null;
  deliverableCreatedAt?: string | Date | null;
}): RevisionWindowInfo {
  const now = Date.now();

  // Phase 1: Completed / Final Delivery Stage
  if (params.status === 'COMPLETED' || params.firstCompletedAt || params.completedAt) {
    const anchor = params.firstCompletedAt ?? params.completedAt ?? params.deliverableCreatedAt ?? params.draftSentAt;
    if (anchor) {
      const anchorTime = new Date(anchor).getTime();
      const daysSince = Math.floor((now - anchorTime) / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.max(0, FINAL_DELIVERY_WINDOW_DAYS - daysSince);
      const isExpired = daysSince > FINAL_DELIVERY_WINDOW_DAYS;

      if (isExpired) {
        return {
          stage: 'EXPIRED',
          windowDays: FINAL_DELIVERY_WINDOW_DAYS,
          daysSince,
          daysRemaining: 0,
          isExpired: true,
          statusLabel: `7-Day Final Window Expired (${daysSince}d ago)`,
          badgeColor: 'red',
          reason: `The complimentary 7-day post-delivery revision window expired ${daysSince - FINAL_DELIVERY_WINDOW_DAYS} days ago.`,
        };
      }

      return {
        stage: 'FINAL_DELIVERY',
        windowDays: FINAL_DELIVERY_WINDOW_DAYS,
        daysSince,
        daysRemaining,
        isExpired: false,
        statusLabel: `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left (7d final window)`,
        badgeColor: daysRemaining <= 2 ? 'amber' : 'emerald',
      };
    }
  }

  // Phase 2: Draft Review Stage (Per-deliverable draft date or draftSentAt)
  const draftAnchor = params.deliverableCreatedAt ?? params.draftSentAt;
  if (draftAnchor || params.status === 'DRAFT_SENT') {
    const anchor = draftAnchor ? new Date(draftAnchor) : new Date();
    const daysSince = Math.floor((now - anchor.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, DRAFT_WINDOW_DAYS - daysSince);
    const isExpired = daysSince > DRAFT_WINDOW_DAYS;

    if (isExpired) {
      return {
        stage: 'EXPIRED',
        windowDays: DRAFT_WINDOW_DAYS,
        daysSince,
        daysRemaining: 0,
        isExpired: true,
        statusLabel: `14-Day Draft Window Expired (${daysSince}d ago)`,
        badgeColor: 'red',
        reason: `The complimentary 14-day draft review window expired ${daysSince - DRAFT_WINDOW_DAYS} days ago.`,
      };
    }

    return {
      stage: 'DRAFT',
      windowDays: DRAFT_WINDOW_DAYS,
      daysSince,
      daysRemaining,
      isExpired: false,
      statusLabel: `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left (14d draft window)`,
      badgeColor: daysRemaining <= 3 ? 'amber' : 'emerald',
    };
  }

// Phase 3: Prior to draft delivery
  return {
    stage: 'NOT_DELIVERED',
    windowDays: DRAFT_WINDOW_DAYS,
    daysSince: 0,
    daysRemaining: DRAFT_WINDOW_DAYS,
    isExpired: false,
    statusLabel: 'Draft pending delivery',
    badgeColor: 'slate',
  };
}

/**
 * Maps a deliverable fileType or label to standardized CareerServiceSlug
 */
export function mapFileTypeToServiceSlug(ft?: string, label?: string): string {
  const t = (ft || '').toLowerCase();
  const l = (label || '').toLowerCase();
  if (t === 'cover_letter' || l.includes('cover letter')) return 'COVER_LETTER';
  if (t.startsWith('linkedin') || l.includes('linkedin') || t === 'linkedin_playbook' || l.includes('playbook')) return 'LINKEDIN';
  if (t === 'portfolio' || t.includes('portfolio') || t.includes('website') || l.includes('portfolio') || l.includes('website')) return 'PORTFOLIO';
  if (t.includes('audit') || l.includes('audit')) return 'RESUME';
  if (t === 'resume' || l.includes('resume') || l.includes('cv')) return 'RESUME';
  return 'RESUME';
}

/**
 * Calculates revision window INDIVIDUALLY per service component.
 * Services delivered at different times (e.g. Resume & Cover Letter on day 1, LinkedIn profile later)
 * have their own independent review cycles.
 * 
 * BUG FIX: When drafts are deleted once final deliverables are delivered (or cleaned up),
 * the revision window must NEVER reset to 0/2 used or NOT_DELIVERED!
 * It detects final deliverables / completion dates and enforces the 7-day final delivery review window.
 */
export function calculateComponentRevisionWindow(params: {
  serviceSlug: string;
  clientStatus: string;
  completedAt?: string | Date | null;
  firstCompletedAt?: string | Date | null;
  deliverables?: { fileType?: string; fileCategory?: string; label?: string; createdAt: string | Date }[];
  draftSentAt?: string | Date | null;
}): RevisionWindowInfo {
  // Phase 1: Check if final deliverables exist for this component or client
  const finalsForComponent = (params.deliverables ?? []).filter(
    d => d.fileCategory === 'final' &&
         mapFileTypeToServiceSlug(d.fileType, d.label) === params.serviceSlug
  );
  const allFinals = (params.deliverables ?? []).filter(d => d.fileCategory === 'final');

  const isCompletedProject = params.clientStatus === 'COMPLETED' || Boolean(params.firstCompletedAt || params.completedAt);
  const hasFinals = finalsForComponent.length > 0 || (allFinals.length > 0 && params.clientStatus !== 'UNDER_PROCESS');

  if (isCompletedProject || hasFinals) {
    const anchor = params.firstCompletedAt ?? params.completedAt ?? finalsForComponent[0]?.createdAt ?? allFinals[0]?.createdAt;
    return calculateRevisionWindow({
      status: 'COMPLETED',
      completedAt: anchor,
      firstCompletedAt: params.firstCompletedAt ?? anchor,
    });
  }

  // Phase 2: Find draft deliverables matching this specific component service
  const draftsForComponent = (params.deliverables ?? []).filter(
    d => d.fileCategory === 'draft' &&
         mapFileTypeToServiceSlug(d.fileType, d.label) === params.serviceSlug
  );

  if (draftsForComponent.length > 0) {
    // Sort descending to find the latest draft of this component
    const latestDraft = [...draftsForComponent].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];

    return calculateRevisionWindow({
      status: params.clientStatus,
      deliverableCreatedAt: latestDraft.createdAt,
    });
  }

  // Phase 3: If drafts were deleted / cleaned up, but draftSentAt is recorded on the client
  if (params.draftSentAt) {
    return calculateRevisionWindow({
      status: params.clientStatus,
      draftSentAt: params.draftSentAt,
    });
  }

  // Phase 4: If no draft exists for this component yet, its 14-day review window has NOT started!
  return {
    stage: 'NOT_DELIVERED',
    windowDays: DRAFT_WINDOW_DAYS,
    daysSince: 0,
    daysRemaining: DRAFT_WINDOW_DAYS,
    isExpired: false,
    statusLabel: 'Draft pending delivery',
    badgeColor: 'slate',
    reason: 'Initial draft has not yet been uploaded for this service component. 14-day review window begins upon upload.',
  };
}
