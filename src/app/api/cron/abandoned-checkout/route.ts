import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { sendCheckoutRecoveryEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    // Check for authorization header if needed, but since it's a cron, Vercel secures it via CRON_SECRET
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const now = new Date();
    
    // Find all PENDING invoices
    const pendingInvoices = await db.invoice.findMany({
      where: {
        status: 'PENDING',
      }
    });

    let emailsSent = 0;

    for (const invoice of pendingInvoices) {
      const hoursSinceCreation = (now.getTime() - invoice.createdAt.getTime()) / (1000 * 60 * 60);
      let newLevel = invoice.abandonedCheckoutLevel;

      if (invoice.abandonedCheckoutLevel === 0 && hoursSinceCreation >= 1) {
        newLevel = 1;
      } else if (invoice.abandonedCheckoutLevel === 1 && hoursSinceCreation >= 24) {
        newLevel = 2;
      } else if (invoice.abandonedCheckoutLevel === 2 && hoursSinceCreation >= 72) {
        newLevel = 3;
      } else if (invoice.abandonedCheckoutLevel === 3 && hoursSinceCreation >= 168) { // 7 days
        newLevel = 4;
      }

      if (newLevel > invoice.abandonedCheckoutLevel) {
        // We need to send an email!
        try {
          // This must be cast or modified because invoice is returned from Prisma
          // We will use our new email function
          await sendCheckoutRecoveryEmail(invoice as any, newLevel);
          
          await db.invoice.update({
            where: { id: invoice.id },
            data: { abandonedCheckoutLevel: newLevel }
          });
          
          emailsSent++;
        } catch (err) {
          console.error(`Failed to send recovery email for Invoice ${invoice.id}:`, err);
        }
      }
    }

    return NextResponse.json({ success: true, processed: pendingInvoices.length, emailsSent });
  } catch (error) {
    console.error('Abandoned checkout cron error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
