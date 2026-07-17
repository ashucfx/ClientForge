// src/app/rn/portal/[token]/deliverables/page.tsx
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

function getFileIconSvg(ext: string): React.ReactNode {
  switch (ext) {
    case 'pdf': return <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>;
    case 'doc':
    case 'docx': return <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#3b82f6" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>;
    case 'png':
    case 'jpg':
    case 'jpeg': return <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#06b6d4" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>;
    default: return <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>;
  }
}

export default async function PortalDeliverablesPage({ params }: { params: { token: string } }) {
  const client = await prisma.rnClient.findFirst({
    where: { magicToken: params.token },
    include: {
      deliverables: { orderBy: { createdAt: 'desc' } },
    }
  });
  if (!client) notFound();

  return (
    <div className="portal-deliverables">
      <div className="dashboard-header-block">
        <div className="header-greeting">
          <h1>Document Center</h1>
          <p>Access, review, and download all project deliverables.</p>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card glass-panel" style={{ gridColumn: '1 / -1' }}>
          {client.deliverables.length === 0 ? (
            <div className="empty-state-mini">No deliverables have been uploaded yet.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
              {client.deliverables.map(doc => {
                const ext = doc.originalName.split('.').pop()?.toLowerCase() ?? '';
                const isApproved = doc.approvalStatus === 'APPROVED';
                return (
                  <div key={doc.id} className="invoice-card" style={{ flexDirection: 'column', alignItems: 'flex-start', margin: 0 }}>
                    <div className="flex-between w-full" style={{ marginBottom: '16px' }}>
                      <div className="feed-icon" style={{ background: 'var(--rn-bg)', width: 48, height: 48 }}>
                        {getFileIconSvg(ext)}
                      </div>
                      {isApproved && (
                        <span className="portal-nav-badge" style={{ background: 'var(--rn-success)' }}>Approved</span>
                      )}
                    </div>
                    
                    <div className="invoice-card-left">
                      <div className="invoice-title">{doc.label || doc.originalName}</div>
                      <div className="invoice-date">Uploaded {format(new Date(doc.createdAt), 'MMM d, yyyy')}</div>
                    </div>
                    
                    <div className="mt-4 w-full pt-4 border-t" style={{ borderTop: '1px solid var(--rn-border)', display: 'flex', gap: '12px' }}>
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="btn-outline-white w-full text-center" style={{ color: 'var(--rn-text)', borderColor: 'var(--rn-border)' }}>
                        Download
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
