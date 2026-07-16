// src/app/(protected)/rn/projects/page.tsx
import { RippleNexusShell } from '@/components/shells/RippleNexusShell';
import { getAdminSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTenantDb } from '@/lib/db/tenantDb';
import { formatDistanceToNow } from 'date-fns';

export const dynamic = 'force-dynamic';

type Search = { q?: string; stage?: string; status?: string; sort?: string; show?: string };

function buildQuery(params: Search, overrides: Partial<Search>): string {
  const merged = { ...params, ...overrides };
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v) sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export default async function RnProjectsPage({ searchParams }: { searchParams: Search }) {
  const session = await getAdminSession();
  if (!session || (session.role !== 'SUPER_ADMIN' && !session.brandAccess.includes('ripple_nexus'))) {
    redirect('/login');
  }

  const q = (searchParams.q ?? '').trim();
  const stageFilter = searchParams.stage ?? '';
  const statusFilter = searchParams.status ?? '';
  const sort = searchParams.sort ?? 'updated';
  const showArchived = searchParams.show === 'archived';

  const tenantDb = getTenantDb('ripple_nexus');
  const clients = await tenantDb.rnClient.findMany({
    where: {
      lifecycleStatus: showArchived ? { not: 'ACTIVE' } : 'ACTIVE',
      ...(q
        ? {
            OR: [
              { name:        { contains: q, mode: 'insensitive' } },
              { companyName: { contains: q, mode: 'insensitive' } },
              { email:       { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(stageFilter ? { currentStage: stageFilter } : {}),
    },
    include: { serviceModule: true },
    orderBy:
      sort === 'created'  ? { createdAt: 'desc' } :
      sort === 'delivery' ? { expectedDeliveryAt: 'asc' } :
      sort === 'value'    ? { amountPaid: 'desc' } :
      { updatedAt: 'desc' },
  });

  // Distinct stages for the filter chips (from data, not hardcoded)
  const allStages = Array.from(new Set(clients.map(c => c.currentStage))).sort();

  let projects = clients.map((c) => {
    const totalStages = Array.isArray(c.serviceModule.workflowStages) ? c.serviceModule.workflowStages.length : 1;
    const completedStages = Array.isArray(c.completedStages) ? c.completedStages.length : 0;
    const progress = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;
    const atRisk = !!(c.expectedDeliveryAt && new Date(c.expectedDeliveryAt) < new Date() && c.currentStage !== 'COMPLETED');

    return {
      id: c.id,
      client: c.companyName || c.name,
      name: c.serviceModule.name,
      phase: c.currentStage.replace(/_/g, ' '),
      rawStage: c.currentStage,
      status: atRisk ? 'at-risk' : 'on-track',
      progress,
      lifecycle: c.lifecycleStatus,
      lastUpdated: formatDistanceToNow(new Date(c.updatedAt), { addSuffix: true }),
    };
  });

  if (statusFilter === 'at-risk') projects = projects.filter(p => p.status === 'at-risk');
  if (statusFilter === 'on-track') projects = projects.filter(p => p.status === 'on-track');

  const atRiskCount = projects.filter(p => p.status === 'at-risk').length;

  return (
    <RippleNexusShell>
      <main className="rn-page">
        <header style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div className="rn-eyebrow" style={{ marginBottom: 6 }}>Workspace</div>
            <h1 className="rn-title-xl">{showArchived ? 'Archived Projects' : 'Active Projects'}</h1>
            <p className="rn-subtitle" style={{ marginTop: 8 }}>
              {projects.length} project{projects.length === 1 ? '' : 's'}
              {!showArchived && atRiskCount > 0 && <> · <span style={{ color: 'var(--warning)' }}>{atRiskCount} at risk</span></>}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href="/api/rn/projects/export" className="btn-secondary" style={{ padding: '10px 16px', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              Export CSV
            </a>
            <Link href="/rn/projects/new">
              <button className="btn-primary" style={{ padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                + New Project
              </button>
            </Link>
          </div>
        </header>

        {/* Search + filters */}
        <form method="GET" action="/rn/projects" className="rn-filter-bar">
          <input type="search" name="q" defaultValue={q} placeholder="Search projects…" className="input" style={{ minWidth: 240 }} />
          {stageFilter && <input type="hidden" name="stage" value={stageFilter} />}
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
          {showArchived && <input type="hidden" name="show" value="archived" />}
          <select
            name="sort"
            defaultValue={sort}
            className="input"
            style={{ padding: '9px 14px', fontSize: 13, width: 'auto' }}
          >
            <option value="updated">Recently updated</option>
            <option value="created">Newest first</option>
            <option value="delivery">Delivery date</option>
            <option value="value">Highest value</option>
          </select>
          <button type="submit" className="rn-chip">Apply</button>
        </form>

        <div className="rn-filter-bar" style={{ marginTop: -8 }}>
          <Link href={`/rn/projects${buildQuery(searchParams, { status: '', stage: '' })}`} className={`rn-chip${!statusFilter && !stageFilter ? ' active' : ''}`}>All</Link>
          <Link href={`/rn/projects${buildQuery(searchParams, { status: 'at-risk' })}`} className={`rn-chip${statusFilter === 'at-risk' ? ' active' : ''}`}>At Risk</Link>
          <Link href={`/rn/projects${buildQuery(searchParams, { status: 'on-track' })}`} className={`rn-chip${statusFilter === 'on-track' ? ' active' : ''}`}>On Track</Link>
          {allStages.map(s => (
            <Link key={s} href={`/rn/projects${buildQuery(searchParams, { stage: stageFilter === s ? '' : s })}`} className={`rn-chip${stageFilter === s ? ' active' : ''}`}>
              {s.replace(/_/g, ' ')}
            </Link>
          ))}
          <span style={{ flex: 1 }} />
          <Link href={`/rn/projects${buildQuery(searchParams, { show: showArchived ? '' : 'archived' })}`} className={`rn-chip${showArchived ? ' active' : ''}`}>
            {showArchived ? '← Back to Active' : 'Archived'}
          </Link>
        </div>

        <div className="rn-panel" style={{ padding: 0 }}>
          <div className="table-scroll-wrapper">
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th>Client & Project</th>
                  <th>Phase</th>
                  <th>Progress</th>
                  <th>Last Updated</th>
                  <th style={{ textAlign: 'right' }}></th>
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '56px 16px', color: 'var(--text-tertiary)', fontSize: 13 }}>
                      {q || stageFilter || statusFilter
                        ? 'No projects match the current filters.'
                        : <>No projects yet. <Link href="/rn/projects/new" style={{ color: 'var(--plasma)', fontWeight: 600 }}>Create the first one →</Link></>}
                    </td>
                  </tr>
                )}
                {projects.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', transition: 'all 0.2s' }} className="table-row-hover">
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15, marginBottom: 4 }}>{p.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.client}</div>
                    </td>
                    <td>
                      <span className={`rn-badge ${p.status === 'on-track' ? 'success' : 'warning'}`}>{p.phase}</span>
                      {showArchived && <span className="rn-badge neutral" style={{ marginLeft: 6 }}>{p.lifecycle}</span>}
                    </td>
                    <td style={{ width: 250 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 140 }}>
                        <div className="rn-progress-track">
                          <div className={`rn-progress-fill${p.status === 'at-risk' ? ' warning' : ''}`} style={{ width: `${p.progress}%` }} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', width: 36 }}>{p.progress}%</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                      {p.lastUpdated}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link href={`/rn/projects/${p.id}`}>
                        <button className="btn-secondary" style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                          Open Workspace
                        </button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </RippleNexusShell>
  );
}
