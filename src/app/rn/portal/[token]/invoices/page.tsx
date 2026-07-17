import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/pricing';
import PayNowButton from '../PayNowButton';
import { IconCheck, IconDocument } from '@/components/Icons';

export const dynamic = 'force-dynamic';

export default async function PortalInvoicesPage({ params }: { params: { token: string } }) {
  const client = await prisma.rnClient.findFirst({
    where: { magicToken: params.token },
  });
  if (!client) notFound();

  const invoices = await prisma.invoice.findMany({
    where: { clientEmail: client.email, brandId: 'ripple_nexus' },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1 className="portal-title">Invoices</h1>
          <p className="portal-subtitle">View and pay your billing statements</p>
        </div>
      </div>

      <div className="portal-card">
        {invoices.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>
            <IconDocument size={32} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
            <p>No invoices found.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {invoices.map((inv) => {
              const isPaid = inv.status === 'PAID';
              const isOverdue = !isPaid && new Date(inv.dueDate) < new Date();
              const amount = formatCurrency(inv.totalPayable, inv.currencySymbol);

              return (
                <div key={inv.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px', border: '1px solid #1E1F2E', borderRadius: '12px',
                  background: '#13141C',
                }}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '10px',
                      background: isPaid ? 'rgba(16,185,129,0.1)' : 'rgba(124,92,255,0.1)',
                      color: isPaid ? '#10B981' : '#7C5CFF',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <IconDocument size={24} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '15px', color: '#F4F5FA', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {inv.invoiceNumber}
                        {isPaid && <span style={{ fontSize: '11px', background: 'rgba(16,185,129,0.15)', color: '#10B981', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>PAID</span>}
                        {isOverdue && !isPaid && <span style={{ fontSize: '11px', background: 'rgba(239,68,68,0.15)', color: '#EF4444', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>OVERDUE</span>}
                        {!isPaid && !isOverdue && <span style={{ fontSize: '11px', background: 'rgba(124,92,255,0.15)', color: '#7C5CFF', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>PENDING</span>}
                      </div>
                      <div style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '4px' }}>
                        Issued on {format(new Date(inv.invoiceDate), 'MMM d, yyyy')} &bull; Due {format(new Date(inv.dueDate), 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: '16px', color: '#F4F5FA' }}>{amount} {inv.currency}</div>
                    </div>
                    {!isPaid && (inv.razorpayLinkUrl || inv.paypalPaymentUrl) && (
                      <a 
                        href={(inv.razorpayLinkUrl || inv.paypalPaymentUrl)!} 
                        target="_blank" rel="noopener noreferrer"
                        className="portal-pay-btn"
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: inv.paypalPaymentUrl ? '#0070BA' : '#7C5CFF', color: '#fff', textDecoration: 'none', padding: '10px 16px', borderRadius: '12px', fontWeight: 600, fontSize: '14px', transition: 'all 0.2s' }}
                      >
                        {inv.paypalPaymentUrl ? 'Pay with PayPal' : 'Pay via Razorpay'}
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
