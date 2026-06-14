import { prisma as db } from '@/lib/db';

export type TimelineEventType = 
  | 'INVOICE_PAID'
  | 'DELIVERABLE_UPLOADED'
  | 'MESSAGE_SENT'
  | 'REVISION_REQUESTED'
  | 'REVIEW_RECEIVED'
  | 'EMAIL_SENT'
  | 'EMAIL_OPENED'
  | 'EMAIL_CLICKED'
  | 'PROJECT_STAGE_CHANGED'
  | 'FORM_SUBMITTED'
  | 'NOTE_ADDED';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  title: string;
  description?: string;
  timestamp: Date;
  metadata?: any;
  source: 'catalyst' | 'ripple_nexus' | 'flywheel' | 'system';
}

export async function getUnifiedTimeline(contactId: string): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];

  // 1. Fetch Contact
  const contact = await db.contact.findUnique({
    where: { id: contactId },
    include: {
      careerClients: true,
      rnClients: true,
      flywheelProfile: true,
      flywheelCampaignLeads: {
        include: { events: true, campaign: true }
      }
    }
  });

  if (!contact) return [];

  // 2. Fetch Catalyst (CareerClient) Events
  for (const careerClient of contact.careerClients) {
    const activityLogs = await db.careerActivityLog.findMany({ where: { clientId: careerClient.id }});
    const messages = await db.careerMessage.findMany({ where: { clientId: careerClient.id }});
    const revisions = await db.careerRevision.findMany({ where: { clientId: careerClient.id }});
    const deliverables = await db.careerDeliverable.findMany({ where: { clientId: careerClient.id }});
    
    // We'd map these to TimelineEvent... (simplified for this plan implementation)
    activityLogs.forEach(log => {
      events.push({
        id: log.id,
        type: 'PROJECT_STAGE_CHANGED',
        title: log.action,
        timestamp: log.createdAt,
        metadata: log.metadata,
        source: 'catalyst'
      });
    });

    deliverables.forEach(del => {
      events.push({
        id: del.id,
        type: 'DELIVERABLE_UPLOADED',
        title: `Deliverable: ${del.label}`,
        timestamp: del.createdAt,
        source: 'catalyst'
      });
    });

    revisions.forEach(rev => {
      events.push({
        id: rev.id,
        type: 'REVISION_REQUESTED',
        title: `Revision Requested on ${rev.fileLabel || 'Unknown'}`,
        description: rev.note,
        timestamp: rev.createdAt,
        source: 'catalyst'
      });
    });
  }

  // 3. Fetch Ripple Nexus (RnClient) Events
  for (const rnClient of contact.rnClients) {
    const activityLogs = await db.rnActivityLog.findMany({ where: { clientId: rnClient.id }});
    const deliverables = await db.rnDeliverable.findMany({ where: { clientId: rnClient.id }});
    
    activityLogs.forEach(log => {
      events.push({
        id: log.id,
        type: 'PROJECT_STAGE_CHANGED',
        title: log.action,
        timestamp: log.createdAt,
        metadata: log.metadata,
        source: 'ripple_nexus'
      });
    });

    deliverables.forEach(del => {
      events.push({
        id: del.id,
        type: 'DELIVERABLE_UPLOADED',
        title: `Deliverable: ${del.label}`,
        timestamp: del.createdAt,
        source: 'ripple_nexus'
      });
    });
  }

  // 4. Fetch Flywheel Email Events
  for (const lead of contact.flywheelCampaignLeads) {
    lead.events.forEach(evt => {
      let type: TimelineEventType = 'EMAIL_SENT';
      if (evt.eventType === 'OPEN') type = 'EMAIL_OPENED';
      if (evt.eventType === 'CLICK') type = 'EMAIL_CLICKED';

      events.push({
        id: evt.id,
        type,
        title: `Email ${evt.eventType.toLowerCase()}: ${lead.campaign.name}`,
        timestamp: evt.createdAt,
        metadata: evt.metadata,
        source: 'flywheel'
      });
    });
  }

  // 5. Sort Chronologically
  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return events;
}
