import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'EDITOR')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { leads, source = 'EXCEL_IMPORT' } = await req.json();

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ success: false, error: 'No leads provided' }, { status: 400 });
    }

    let importedCount = 0;
    let existingCount = 0;

    const count = await db.contact.count();
    let currentId = count + 1;

    // Use a transaction or sequential operations for bulk import
    // Note: For massive files (10k+), this should be queued. We assume batching on client.
    for (const row of leads) {
      const email = row.email?.trim()?.toLowerCase();
      const name = row.name?.trim() || 'Unknown Contact';
      const phone = row.phone?.trim();
      const jobTitle = row.jobTitle?.trim() || null;
      let timestampDate: Date | undefined;
      let lastContactedDate: Date | undefined;

      if (row.timestamp) {
        if (typeof row.timestamp === 'number' || (!isNaN(Number(row.timestamp)) && Number(row.timestamp) > 10000 && Number(row.timestamp) < 100000)) {
          const excelDays = Number(row.timestamp);
          timestampDate = new Date(Math.round((excelDays - 25569) * 86400 * 1000));
        } else {
          const parsed = new Date(row.timestamp);
          if (!isNaN(parsed.getTime())) timestampDate = parsed;
        }
      }

      if (timestampDate) {
         lastContactedDate = new Date(timestampDate.getTime() + 10 * 24 * 60 * 60 * 1000);
      }

      if (!email && !phone) continue; // Need at least one identifier

      // 1. Find existing contact
      const orConditions: any[] = [];
      if (email) orConditions.push({ email });
      if (phone) orConditions.push({ phone });

      let contact = null;
      if (orConditions.length > 0) {
        contact = await db.contact.findFirst({
          where: {
            OR: orConditions
          }
        });
      }

      if (contact) {
        existingCount++;
        // Update job title if it was missing
        if (jobTitle && !contact.jobTitle) {
          await db.contact.update({
            where: { id: contact.id },
            data: { jobTitle }
          });
        }
      } else {
        // 2. Create new contact
        const displayId = `LD-${1000 + currentId}`;
        currentId++;

        contact = await db.contact.create({
          data: {
            displayId,
            name,
            email: email || null,
            phone: phone || null,
            jobTitle: jobTitle,
            contactSource: source,
            status: 'ACTIVE',
            ...(timestampDate && { createdAt: timestampDate })
          }
        });
        importedCount++;
      }

      // 3. Ensure FlywheelProfile exists
      const profile = await db.flywheelProfile.findUnique({
        where: { contactId: contact.id }
      });

      if (!profile) {
        await db.flywheelProfile.create({
          data: {
            contactId: contact.id,
            lifecycleStage: 'LEAD',
            leadStatus: 'NEW',
            ...(timestampDate && { 
              createdAt: timestampDate,
              lastContactedAt: lastContactedDate 
            })
          }
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      importedCount, 
      existingCount,
      totalProcessed: leads.length
    });

  } catch (error) {
    console.error('[LeadImport] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
