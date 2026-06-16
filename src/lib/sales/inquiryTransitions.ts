import type { InquiryStatus } from '@prisma/client';

export const INQUIRY_STATUS_TRANSITIONS: Record<InquiryStatus, InquiryStatus[]> = {
  NEW: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['QUALIFIED', 'REJECTED', 'REQUEST_INFO'],
  REQUEST_INFO: ['UNDER_REVIEW'],
  QUALIFIED: ['PROPOSAL_SENT', 'REJECTED'],
  PROPOSAL_SENT: ['APPROVED', 'LOST'],
  APPROVED: ['INVOICE_SENT'],
  INVOICE_SENT: ['CONVERTED', 'LOST'],
  REJECTED: ['LOST'],
  CONVERTED: [],
  LOST: [],
};

export function canTransitionInquiry(from: InquiryStatus, to: InquiryStatus): boolean {
  return INQUIRY_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
