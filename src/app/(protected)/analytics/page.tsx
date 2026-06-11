'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { useBrand } from '@/components/BrandProvider';
import { IconTrendUp, IconDocument, IconCheck, IconPending, IconUser } from '@/components/Icons';
import { formatCurrency } from '@/lib/pricing';

export default function AnalyticsDashboard() {
  const { activeBrand } = useBrand();
  const [data, setData] = useState<any>(null);
  const [slaData, setSlaData] = useState<any>(null);
  const [satData, setSatData] = useState<any>(null);
  const [lifecycleData, setLifecycleData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      try {
        const [execRes, slaRes, satRes, lfRes] = await Promise.all([
          fetch('/api/admin/analytics/executive'),
          fetch('/api/admin/analytics/sla'),
          fetch('/api/admin/analytics/satisfaction'),
          fetch('/api/admin/analytics/lifecycle')
        ]);
        if (execRes.ok) setData(await execRes.json());
        if (slaRes.ok) setSlaData(await slaRes.json());
        if (satRes.ok) setSatData(await satRes.json());
        if (lfRes.ok) setLifecycleData(await lfRes.json());
      } catch (err) {
        console.error('Failed to fetch analytics', err);
      }
      setLoading(false);
    }
    fetchAnalytics();
  }, []);

  const KpiCard = ({ label, value, sub, icon, bg, accent = false }: any) => (
    <div className="kpi-card" style={accent ? { borderColor: '#bfdbfe', boxShadow: '0 0 0 1px #bfdbfe, 0 4px 12px rgba(31,86,212,.08)' } : {}}>
      <div className="kpi-icon" style={{ background: bg }}>{icon}</div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={accent ? { color: 'var(--brand)' } : {}}>{value}</div>
      {sub && <div className="kpi-sub" style={{ marginTop: 8 }}>{sub}</div>}
    </div>
  );

  return (
    <AppShell>
      <div className="page-header" style={{ paddingBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Executive Analytics</h1>
            <p className="page-subtitle">Operational Intelligence & Satisfaction KPIs</p>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0', color: 'var(--text-tertiary)' }}>
            Loading analytics...
          </div>
        ) : data ? (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>Business Overview</h2>
            <div className="grid-4" style={{ marginBottom: 32 }}>
              <KpiCard 
                label="Total Revenue" 
                value={formatCurrency(data.kpis?.totalRevenue || 0, '₹')} 
                icon={<IconTrendUp style={{ color: 'var(--brand)' }} />} 
                bg="#eff6ff" 
                accent 
              />
              <KpiCard 
                label="Active Clients" 
                value={data.kpis?.totalActiveClients || 0} 
                icon={<IconUser style={{ color: '#3FBD8B' }} />} 
                bg="#d1fae5" 
                sub="Currently engaged"
              />
              <KpiCard 
                label="Net Promoter Score" 
                value={data.kpis?.nps || 0} 
                icon={<span style={{ color: '#8b5cf6', fontWeight: 'bold' }}>NPS</span>} 
                bg="#ede9fe" 
                sub={`Avg Rating: ${data.kpis?.avgRating || 0} / 5`}
              />
              <KpiCard 
                label="SLA Met %" 
                value={`${data.kpis?.slaMetPercentage || 0}%`} 
                icon={<IconCheck style={{ color: '#059669' }} />} 
                bg="#d1fae5" 
                sub="Lifetime"
              />
            </div>

            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>Operational Intelligence</h2>
            <div className="grid-4" style={{ marginBottom: 32 }}>
              <KpiCard 
                label="Pending Deliveries" 
                value={data.operations?.pendingDeliveries || 0} 
                icon={<IconDocument style={{ color: '#d97706' }} />} 
                bg="#fef3c7" 
                sub="Awaiting action"
              />
              <KpiCard 
                label="Pending Revisions" 
                value={data.operations?.pendingRevisions || 0} 
                icon={<IconPending style={{ color: '#ea580c' }} />} 
                bg="#ffedd5" 
              />
              <KpiCard 
                label="Escalated Unread" 
                value={data.operations?.unreadMessagesEscalated || 0} 
                icon={<span style={{ color: '#dc2626', fontWeight: 'bold' }}>!</span>} 
                bg="#fee2e2" 
                sub="> 24 hours"
              />
              <KpiCard 
                label="At-Risk Clients" 
                value={data.risks?.atRiskClients || 0} 
                icon={<span style={{ color: '#b91c1c', fontWeight: 'bold' }}>⚠️</span>} 
                bg="#fef2f2" 
                sub="Health < 50"
              />
            </div>

            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>Client Lifecycle & Re-Engagement</h2>
            <div className="grid-4" style={{ marginBottom: 32 }}>
              <KpiCard 
                label="Total Archived" 
                value={lifecycleData?.totalArchived || 0} 
                icon={<IconDocument style={{ color: '#6b7280' }} />} 
                bg="#f3f4f6" 
                sub="Past clients"
              />
              <KpiCard 
                label="Reactivation Rate" 
                value={`${lifecycleData?.reactivationRate || 0}%`} 
                icon={<IconTrendUp style={{ color: '#0ea5e9' }} />} 
                bg="#e0f2fe" 
                sub={`${lifecycleData?.totalReactivated || 0} returned`}
              />
              <KpiCard 
                label="Repeat Client Revenue" 
                value={formatCurrency(lifecycleData?.repeatRevenue || 0, '₹')} 
                icon={<span style={{ color: '#10b981', fontWeight: 'bold' }}>₹</span>} 
                bg="#d1fae5" 
                sub="From Upgrades/Add-ons"
              />
              <KpiCard 
                label="Lifetime Value (LTV)" 
                value={formatCurrency(lifecycleData?.ltv || 0, '₹')} 
                icon={<IconUser style={{ color: '#8b5cf6' }} />} 
                bg="#ede9fe" 
                sub="Average per client"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* Delivery Performance */}
              <div className="card" style={{ padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Delivery Performance</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Average Delivery Time</span>
                    <span style={{ fontWeight: 700 }}>{slaData?.lifetime?.averageDeliveryTimeDays || 0} days</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>SLA Missed %</span>
                    <span style={{ fontWeight: 700, color: 'var(--error)' }}>{slaData?.lifetime?.slaMissedPercentage || 0}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Revision Rate</span>
                    <span style={{ fontWeight: 700 }}>{slaData?.lifetime?.revisionRate || 0} per client</span>
                  </div>
                </div>
              </div>

              {/* Satisfaction Analytics */}
              <div className="card" style={{ padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Satisfaction Analytics</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Reviews Collected</span>
                    <span style={{ fontWeight: 700 }}>{satData?.reviewsCount || 0}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Highest Rated Service</span>
                    <span style={{ fontWeight: 700, color: '#059669' }}>{satData?.mostLovedService || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Lowest Rated Service</span>
                    <span style={{ fontWeight: 700, color: '#dc2626' }}>{satData?.lowestRatedService || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
