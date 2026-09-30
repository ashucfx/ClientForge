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
    const anchor = params.firstCompletedAt ?? params.completedAt;
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
