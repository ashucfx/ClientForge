// src/lib/events/dispatcher.ts
import { EventEmitter } from 'events';
import { TenantContext } from '@/lib/auth/TenantContext';
import { 
  syncFlywheelOnInvoicePaid, 
  syncFlywheelOnClientCreated, 
  syncFlywheelOnProjectDelivered, 
  syncFlywheelOnClientArchived,
  syncFlywheelOnReviewReceived,
  syncFlywheelOnRevisionRequested,
  syncFlywheelOnDeliverableUploaded
} from './flywheelSync';

export interface WorkflowEventPayload {
  tenantContext: TenantContext;
  entityId: string;
  metadata?: Record<string, any>;
  contactId?: string;
  amount?: number;
  date?: Date;
  isReactivation?: boolean;
}

export type EventTypes = 
  | 'INVOICE_PAID'
  | 'CLIENT_ONBOARDED'
  | 'REVISION_REQUESTED'
  | 'DELIVERABLE_UPLOADED'
  | 'CLIENT_CREATED'
  | 'INVOICE_CREATED'
  | 'PROJECT_DELIVERED'
  | 'REVIEW_RECEIVED'
  | 'CLIENT_ARCHIVED';

class WorkflowDispatcher extends EventEmitter {
  dispatch(event: EventTypes, payload: WorkflowEventPayload) {
    console.log(`[EventBus] Dispatching ${event} for tenant ${payload.tenantContext.tenantId} (Entity: ${payload.entityId})`);
    this.emit(event, payload);
  }
}

export const EventBus = new WorkflowDispatcher();

// ─── Core Workflow Bindings ──────────────────────────────────────────────────
// We isolate the workflow execution logic to prevent massive route handlers.

EventBus.on('INVOICE_PAID', async (payload: WorkflowEventPayload) => {
  if (payload.tenantContext.tenantId === 'ripple_nexus') {
    // Fire off Ripple Nexus specific provisioning
    console.log(`[RnWorkflow] Provisioning agency portal for invoice ${payload.entityId}`);
  } else if (payload.tenantContext.tenantId === 'catalyst') {
    // Fire off Catalyst specific workflows
    console.log(`[CatalystWorkflow] Moving career client to UNDER_PROCESS for invoice ${payload.entityId}`);
  }
  
  if (payload.amount !== undefined && payload.date) {
    syncFlywheelOnInvoicePaid(payload as any);
  }
});

EventBus.on('CLIENT_CREATED', async (payload: WorkflowEventPayload) => {
  syncFlywheelOnClientCreated(payload as any);
});

EventBus.on('PROJECT_DELIVERED', async (payload: WorkflowEventPayload) => {
  syncFlywheelOnProjectDelivered(payload as any);
});

EventBus.on('CLIENT_ARCHIVED', async (payload: WorkflowEventPayload) => {
  syncFlywheelOnClientArchived(payload as any);
});

EventBus.on('REVIEW_RECEIVED', async (payload: WorkflowEventPayload) => {
  syncFlywheelOnReviewReceived(payload as any);
});

EventBus.on('REVISION_REQUESTED', async (payload: WorkflowEventPayload) => {
  syncFlywheelOnRevisionRequested(payload as any);
});

EventBus.on('DELIVERABLE_UPLOADED', async (payload: WorkflowEventPayload) => {
  syncFlywheelOnDeliverableUploaded(payload as any);
});

