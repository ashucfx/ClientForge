import { RippleNexusShell } from '@/components/shells/RippleNexusShell';
import { getAdminSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTenantDb } from '@/lib/db/tenantDb';
import { format } from 'date-fns';
import Link from 'next/link';
import { IconGrid } from '@/components/Icons';

export default async function RnDeliverablesPage() {
  const session = await getAdminSession();
  if (!session || (session.role !== 'SUPER_ADMIN' && !session.brandAccess.includes('ripple_nexus'))) {
    redirect('/login');
  }

  const tenantDb = getTenantDb('ripple_nexus');

  const deliverables = await tenantDb.rnDeliverable.findMany({
    include: { client: { include: { serviceModule: true } } },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <RippleNexusShell>
      <main className="rn-page">
        
        <header style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 className="rn-title-xl">Global Deliverables</h1>
            <p className="rn-subtitle" style={{ marginTop: 8 }}>All assets and files delivered across all Ripple Nexus projects.</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <select className="input" style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, background: 'var(--surface-2)' }}>
              <option>All File Types</option>
              <option>Documents</option>
              <option>Designs</option>
              <option>Spreadsheets</option>
            </select>
            <select className="input" style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, background: 'var(--surface-2)' }}>
              <option>All Statuses</option>
              <option>Needs Review</option>
              <option>Approved</option>
            </select>
          </div>
        </header>

        <div className="rn-panel">
          <div className="rn-panel-body" style={{ padding: 0 }}>
            {deliverables.length === 0 ? (
              <div style={{ padding: '64px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                <IconGrid size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
                <div style={{ fontSize: 16, fontWeight: 600 }}>No deliverables uploaded yet</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Files uploaded in project workspaces will appear here.</div>
              </div>
            ) : deliverables.map((d) => {
              const type = d.mimeType?.includes('pdf') ? 'document' : d.mimeType?.includes('image') ? 'design' : 'spreadsheet';
              
              return (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="table-row-hover">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 10, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)', fontSize: 24 }}>
                      {type === 'document' ? '📄' : type === 'design' ? '🎨' : '📊'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14, marginBottom: 4 }}>{d.label}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {d.client.companyName || d.client.name} • {d.client.serviceModule.name}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Uploaded By {d.uploadedBy === session.adminId ? 'You' : 'System'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{format(new Date(d.createdAt), 'MMM d, yyyy h:mm a')}</div>
                    </div>
                    <span className={`rn-badge ${d.fileCategory === 'final' ? 'success' : 'warning'}`} style={{ width: 100, textAlign: 'center' }}>
                      {d.fileCategory.replace('-', ' ')}
                    </span>
                    <Link href={`/rn/projects/${d.clientId}`}>
                      <button className="btn-secondary" style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12 }}>View in Project</button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
      <style dangerouslySetInnerHTML={{__html: `
        .table-row-hover:hover { background: var(--surface-3) !important; }
      `}} />
    </RippleNexusShell>
  );
}
