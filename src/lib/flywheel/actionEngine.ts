import { prisma as db } from '@/lib/db';
import { ACTIVE_RULES } from './flywheelRules';

export async function evaluateContactRules(contactId: string) {
  const contact = await db.contact.findUnique({
    where: { id: contactId },
    include: {
      flywheelProfile: true,
      careerClients: {
        include: { services: { include: { service: true } } }
      },
      rnClients: true
    }
  });

  if (!contact) return;

  for (const rule of ACTIVE_RULES) {
    try {
      const result = await rule.evaluate(contact);
      
      if (result) {
        // Idempotency: Check if an action card of this exact title/suggestedAction already exists and is pending/executed
        const existing = await db.flywheelActionCard.findFirst({
          where: {
            contactId,
            suggestedAction: result.suggestedAction,
            status: { in: ['PENDING', 'EXECUTED'] }
          }
        });

        if (!existing) {
          await db.flywheelActionCard.create({
            data: {
              contactId,
              type: rule.type,
              title: result.title,
              reason: result.reason,
              confidence: result.confidence,
              revenuePotential: result.revenuePotential,
              suggestedAction: result.suggestedAction,
              actionData: result.actionData || {},
              priority: result.priority
            }
          });
          console.log(`[ActionEngine] Created Action Card [${result.title}] for contact ${contactId}`);
        }
      }
    } catch (error) {
      console.error(`[ActionEngine] Rule evaluation failed for rule ${rule.id} on contact ${contactId}:`, error);
    }
  }
}

export async function evaluateAllContacts() {
  const contacts = await db.contact.findMany({ select: { id: true }, where: { status: 'ACTIVE' } });

  const BATCH_SIZE = 50;
  let count = 0;
  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch = contacts.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(c => evaluateContactRules(c.id).catch(err =>
      console.error(`[ActionEngine] evaluateContactRules failed for ${c.id}:`, err)
    )));
    count += batch.length;
  }
  return count;
}
