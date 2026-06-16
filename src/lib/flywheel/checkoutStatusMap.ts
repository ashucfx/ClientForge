/**
 * Flywheel status mapper for /checkout checkout flow events.
 * Maps checkout events → FlywheelProfile field updates.
 */

import type { CheckoutSessionStatus } from '@prisma/client';

export function checkoutStatusToLeadStatus(status: CheckoutSessionStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'NEW';
    case 'INVOICE_CREATED':
      return 'OPEN';
    case 'PAID':
      return 'QUALIFIED';
    case 'ABANDONED':
      return 'OPEN';
    case 'EXPIRED':
      return 'UNQUALIFIED';
    default:
      return 'NEW';
  }
}

export function checkoutStatusToLifecycleStage(status: CheckoutSessionStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'LEAD';
    case 'INVOICE_CREATED':
      return 'OPPORTUNITY';
    case 'PAID':
      return 'CUSTOMER';
    case 'ABANDONED':
      return 'LEAD';
    case 'EXPIRED':
      return 'LEAD';
    default:
      return 'LEAD';
  }
}
