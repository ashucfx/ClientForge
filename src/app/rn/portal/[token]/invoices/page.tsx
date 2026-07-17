// src/app/rn/portal/[token]/invoices/page.tsx
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

export default async function PortalInvoicesPage({ params }: { params: { token: string } }) {
  const client = await prisma.rnClient.findFirst({
    where: { magicToken: params.token }
  });
  if (!client) notFound();

  const invoices = await prisma.invoice.findMany({
    where: { clientEmail: client.email, brandId: 'ripple_nexus' },
    orderBy: { createdAt: 'desc' },
  });

  const unpaidCount = invoices.filter(i => i.status === 'PENDING').length;
  const totalPaid = invoices.filter(i => i.status === 'PAID').reduce((acc, i) => acc + (i.totalPayable || 0), 0);

  return (
    <div className="portal-invoices">
      <div className="dashboard-header-block">
        <div className="header-greeting">
          <h1>Invoices & Payments</h1>
          <p>Manage your billing and payment history.</p>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card glass-panel">
          <div className="metric-label">Outstanding Invoices</div>
          <div className="metric-value">{unpaidCount}</div>
        </div>
        <div className="metric-card glass-panel">
          <div className="metric-label">Total Amount Paid</div>
          <div className="metric-value">${totalPaid.toLocaleString()}</div>
        </div>
      </div>

      <div className="panel glass-panel mt-8">
        <div className="panel-header">
          <h2>Payment History</h2>
        </div>
        
        {invoices.length === 0 ? (
          <div className="empty-state-mini">No invoices have been generated yet.</div>
        ) : (
          <div className="invoice-list">
            {invoices.map((inv) => {
              const isPaid = inv.status === 'PAID';
              return (
                <div key={inv.id} className="invoice-card">
                  <div className="invoice-card-left">
                    <div className="invoice-title">{inv.invoiceNumber}</div>
                    <div className="invoice-date">
                      {isPaid ? `Paid on ${format(new Date(inv.updatedAt), 'MMM d, yyyy')}` : `Due ${format(new Date(inv.dueDate), 'MMM d, yyyy')}`}
                    </div>
                  </div>
                  <div className="invoice-card-right">
                    <div className="invoice-amount">${(inv.totalPayable || 0).toLocaleString()}</div>
                    <div className="invoice-actions">
                      {isPaid ? (
                        <span className="portal-nav-badge" style={{ background: 'var(--rn-success)' }}>PAID</span>
                      ) : (
                        <a href={`/rn/invoices/${inv.id}`} className="btn-premium alert-btn" style={{ padding: '6px 12px', fontSize: '12px' }}>Pay Now</a>
                      )}
                    </div>
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
