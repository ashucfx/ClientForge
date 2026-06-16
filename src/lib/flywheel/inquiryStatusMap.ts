import type { InquiryStatus } from '@prisma/client';

/** Maps SalesInquiry.status → FlywheelProfile.leadStatus for display (non-destructive adapter) */
export function inquiryStatusToLeadStatus(status: InquiryStatus): string {
  switch (status) {
    case 'NEW':
      return 'NEW';
    case 'UNDER_REVIEW':
    case 'REQUEST_INFO':
      return 'OPEN';
    case 'QUALIFIED':
    case 'APPROVED':
      return 'QUALIFIED';
    case 'PROPOSAL_SENT':
    case 'INVOICE_SENT':
      return 'IN_PROGRESS';
    case 'CONVERTED':
      return 'QUALIFIED';
    case 'REJECTED':
    case 'LOST':
      return 'UNQUALIFIED';
    default:
      return 'NEW';
  }
}

export function inquiryStatusToLifecycleStage(status: InquiryStatus): string {
  if (status === 'CONVERTED') return 'CUSTOMER';
  if (['PROPOSAL_SENT', 'INVOICE_SENT', 'APPROVED', 'QUALIFIED'].includes(status)) {
    return 'OPPORTUNITY';
  }
  return 'LEAD';
}
