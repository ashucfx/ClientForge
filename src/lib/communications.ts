import { prisma as db } from '@/lib/db';

type ClientType = 'CAREER' | 'RN';
type AuthorType = 'client' | 'admin';

export type SlaEvent = 'NEW_MESSAGE' | 'REVISION_REQUEST' | 'ONBOARDING' | 'GENERAL_COMMENT' | 'ARCHIVED_INQUIRY' | 'FEEDBACK_COMPLAINT';

export function getSlaHours(event: SlaEvent): number {
  switch (event) {
    case 'FEEDBACK_COMPLAINT': return 6;
    case 'NEW_MESSAGE': return 12;
    case 'REVISION_REQUEST': return 12;
    case 'ONBOARDING': return 24;
    case 'GENERAL_COMMENT': return 24;
    case 'ARCHIVED_INQUIRY': return 48;
    default: return 24;
  }
}

export type SlaStatus = 'HEALTHY' | 'DUE_SOON' | 'BREACHED';

export function getSlaStatus(adminSlaDeadline: Date | null): SlaStatus | null {
  if (!adminSlaDeadline) return null;
  const now = new Date();
  const timeRemainingMs = adminSlaDeadline.getTime() - now.getTime();
  
  if (timeRemainingMs < 0) return 'BREACHED';
  // If due within 2 hours, it's DUE_SOON
  if (timeRemainingMs < 2 * 60 * 60 * 1000) return 'DUE_SOON';
  
  return 'HEALTHY';
}

/**
 * Records a new message being sent in the global read state
 */
export async function recordMessageSent(clientId: string, clientType: ClientType, authorType: AuthorType, slaEvent?: SlaEvent) {
  const isCareer = clientType === 'CAREER';
  
  const whereClause = isCareer ? { careerClientId: clientId } : { rnClientId: clientId };
  let adminSlaDeadline: Date | null = null;
  if (authorType === 'client' && slaEvent) {
    adminSlaDeadline = new Date();
    adminSlaDeadline.setHours(adminSlaDeadline.getHours() + getSlaHours(slaEvent));
  }

  const createData = {
    careerClientId: isCareer ? clientId : null,
    rnClientId: !isCareer ? clientId : null,
    unreadByAdmin: authorType === 'client' ? 1 : 0,
    unreadByClient: authorType === 'admin' ? 1 : 0,
    lastMessageAt: new Date(),
    lastMessageBy: authorType,
    adminSlaDeadline,
    adminSlaEvent: slaEvent ?? null,
  };

  await db.conversationReadState.upsert({
    where: whereClause as any,
    create: createData,
    update: {
      unreadByAdmin: authorType === 'client' ? { increment: 1 } : undefined,
      unreadByClient: authorType === 'admin' ? { increment: 1 } : undefined,
      lastMessageAt: new Date(),
      lastMessageBy: authorType,
      ...(authorType === 'client' && slaEvent ? {
        adminSlaDeadline,
        adminSlaEvent: slaEvent
      } : authorType === 'admin' ? {
        adminSlaDeadline: null,
        adminSlaEvent: null
      } : {})
    },
  });
}

/**
 * Marks a conversation as read by the admin
 */
export async function markConversationReadByAdmin(clientId: string, clientType: ClientType) {
  const isCareer = clientType === 'CAREER';

  // 1. Mark individual messages as read and capture the count
  let markedCount = 0;
  if (isCareer) {
    const result = await db.careerMessage.updateMany({
      where: { clientId, authorType: 'client', readByAdmin: false },
      data: { readByAdmin: true, readByAdminAt: new Date() }
    });
    const result2 = await db.careerComment.updateMany({
      where: { clientId, authorType: 'client', readByAdmin: false },
      data: { readByAdmin: true, readByAdminAt: new Date() }
    });
    markedCount = result.count + result2.count;
  } else {
    const result = await db.rnMessage.updateMany({
      where: { clientId, authorType: 'client', readByAdmin: false },
      data: { readByAdmin: true, readByAdminAt: new Date() }
    });
    markedCount = result.count;
  }

  // 2. Safely decrement the unread state atomically
  if (markedCount > 0) {
    const whereClause = isCareer ? { careerClientId: clientId } : { rnClientId: clientId };
    await db.conversationReadState.upsert({
      where: whereClause as any,
      create: {
        careerClientId: isCareer ? clientId : null,
        rnClientId: !isCareer ? clientId : null,
        unreadByAdmin: 0,
        unreadByClient: 0,
        lastMessageAt: new Date(),
        lastMessageBy: 'client'
      },
      update: {
        unreadByAdmin: { decrement: markedCount }
      }
    });
  }
}

/**
 * Marks a conversation as read by the client
 */
export async function markConversationReadByClient(clientId: string, clientType: ClientType) {
  const isCareer = clientType === 'CAREER';

  let markedCount = 0;
  if (isCareer) {
    const result = await db.careerMessage.updateMany({
      where: { clientId, authorType: 'admin', readByClient: false },
      data: { readByClient: true, readByClientAt: new Date() }
    });
    const result2 = await db.careerComment.updateMany({
      where: { clientId, authorType: 'admin', readByClient: false },
      data: { readByClient: true, readByClientAt: new Date() }
    });
    markedCount = result.count + result2.count;
  } else {
    const result = await db.rnMessage.updateMany({
      where: { clientId, authorType: 'admin', readByClient: false },
      data: { readByClient: true, readByClientAt: new Date() }
    });
    markedCount = result.count;
  }

  if (markedCount > 0) {
    const whereClause = isCareer ? { careerClientId: clientId } : { rnClientId: clientId };
    await db.conversationReadState.upsert({
      where: whereClause as any,
      create: {
        careerClientId: isCareer ? clientId : null,
        rnClientId: !isCareer ? clientId : null,
        unreadByAdmin: 0,
        unreadByClient: 0,
        lastMessageAt: new Date(),
        lastMessageBy: 'admin'
      },
      update: {
        unreadByClient: { decrement: markedCount }
      }
    });
  }
}
