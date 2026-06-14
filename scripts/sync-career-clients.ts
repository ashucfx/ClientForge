import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function syncCareerClientToFlywheel(clientId: string) {
  try {
    const client = await db.careerClient.findUnique({
      where: { id: clientId }
    });

    if (!client) return false;

    // Determine lifecycle stage and lead status based on CareerStatus
    let lifecycleStage = 'LEAD';
    let leadStatus = 'IN_PROGRESS';

    if (client.status === 'COMPLETED') {
      lifecycleStage = 'CUSTOMER';
      leadStatus = 'CONTACTED';
    }

    // Try to find existing contact by email or the linked contactId
    let contact = null;
    if (client.contactId) {
      contact = await db.contact.findUnique({ where: { id: client.contactId } });
    }
    
    if (!contact) {
      contact = await db.contact.findFirst({ where: { email: { equals: client.email, mode: 'insensitive' } } });
    }

    let contactId = contact?.id;

    if (!contact) {
      // Need to create a new Contact. Generate displayId.
      let nextId = 1000;
      const allContacts = await db.contact.findMany({ select: { displayId: true } });
      for (const c of allContacts) {
        if (c.displayId) {
          const num = parseInt(c.displayId.split('-')[1]);
          if (!isNaN(num) && num > nextId) {
            nextId = num;
          }
        }
      }
      nextId++;

      contact = await db.contact.create({
        data: {
          displayId: `LD-${nextId}`,
          name: client.name,
          email: client.email,
          phone: client.phone,
          contactSource: 'Catalyst Career',
          createdAt: client.createdAt,
          flywheelProfile: {
            create: {
              lifecycleStage,
              leadStatus,
              totalRevenue: client.amountPaid || 0,
              createdAt: client.createdAt,
              lastContactedAt: client.status === 'COMPLETED' ? (client.completedAt || new Date()) : null,
              lastInvoiceDate: client.invoiceId ? new Date() : null,
            }
          }
        }
      });
      contactId = contact.id;

      // Link it back to the CareerClient
      await db.careerClient.update({
        where: { id: client.id },
        data: { contactId: contact.id }
      });

    } else {
      // Update existing contact
      await db.contact.update({
        where: { id: contact.id },
        data: {
          name: client.name,
          phone: client.phone || contact.phone,
          contactSource: 'Catalyst Career',
          createdAt: client.createdAt,
        }
      });

      // Upsert FlywheelProfile
      const existingProfile = await db.flywheelProfile.findUnique({
        where: { contactId: contact.id }
      });

      if (existingProfile) {
        // Only update if we are moving forward (e.g. they became a customer)
        const updateData: any = {
          totalRevenue: Math.max(existingProfile.totalRevenue || 0, client.amountPaid || 0)
        };
        
        if (client.status === 'COMPLETED') {
          updateData.lifecycleStage = 'CUSTOMER';
          updateData.leadStatus = 'CONTACTED';
          updateData.lastContactedAt = client.completedAt || new Date();
        }
        
        updateData.createdAt = client.createdAt;

        await db.flywheelProfile.update({
          where: { id: existingProfile.id },
          data: updateData
        });
      } else {
        await db.flywheelProfile.create({
          data: {
            contactId: contact.id,
            lifecycleStage,
            leadStatus,
            totalRevenue: client.amountPaid || 0,
            createdAt: client.createdAt,
            lastContactedAt: client.status === 'COMPLETED' ? (client.completedAt || new Date()) : null,
          }
        });
      }

      // Link back just in case
      if (!client.contactId) {
        await db.careerClient.update({
          where: { id: client.id },
          data: { contactId: contact.id }
        });
      }
    }

    return true;
  } catch (error) {
    console.error('[syncCareerClientToFlywheel] Error:', error);
    return false;
  }
}

async function main() {
  console.log('Starting sync...');
  const clients = await db.careerClient.findMany({ select: { id: true, email: true } });
  console.log(`Found ${clients.length} Career clients.`);
  
  let synced = 0;
  for (const client of clients) {
    console.log(`Syncing ${client.email}...`);
    const ok = await syncCareerClientToFlywheel(client.id);
    if (ok) synced++;
  }
  
  console.log(`Done. Synced ${synced}/${clients.length} clients.`);
}

main().catch(console.error).finally(() => db.$disconnect());
