// src/lib/events/dispatcher.ts
import { EventEmitter } from 'events';
import { TenantContext } from '@/lib/auth/TenantContext';

export interface WorkflowEventPayload {
  tenantContext: TenantContext;
  entityId: string;
  metadata?: Record<string, any>;
}

export type EventTypes = 
  | 'INVOICE_PAID'
  | 'CLIENT_ONBOARDED'
  | 'REVISION_REQUESTED'
  | 'DELIVERABLE_UPLOADED';

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
    // await provisionAgencyPortal(payload.entityId);
  } else if (payload.tenantContext.tenantId === 'catalyst') {
    // Fire off Catalyst specific workflows
    console.log(`[CatalystWorkflow] Moving career client to UNDER_PROCESS for invoice ${payload.entityId}`);
  }
});
