'use client';

import { useState, useEffect } from 'react';
import { useBrand } from '@/components/BrandProvider';
import { IconPlus, IconTrendUp, IconList } from '@/components/Icons';

export default function FlywheelCampaignsPage() {
  const { activeBrand } = useBrand();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  // New Campaign Form State
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [contentHtml, setContentHtml] = useState('');

  useEffect(() => {
    fetchCampaigns();
  }, [activeBrand]);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/flywheel/campaigns?brandId=${activeBrand}`);
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch campaigns', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      // Create campaign
      const res = await fetch('/api/admin/flywheel/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          brandId: activeBrand,
          type: 'ONE_OFF',
          steps: [
            { subject, contentHtml, delayHours: 0 }
          ]
        })
      });

      const data = await res.json();
      if (data.success) {
        setShowForm(false);
        setName('');
        setSubject('');
        setContentHtml('');
        fetchCampaigns();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      alert('Failed to create campaign');
    } finally {
      setCreating(false);
    }
  };

  const handleDispatch = async (campaignId: string) => {
    if (!confirm('Are you sure you want to dispatch this campaign to ALL leads?')) return;

    try {
      // First, fetch all leads (simplified for v1 - should be segmented in v2)
      const leadsRes = await fetch('/api/admin/flywheel/leads');
      const leadsData = await leadsRes.json();
      const contactIds = leadsData.data.map((c: any) => c.id);

      if (contactIds.length === 0) {
        alert('No leads to dispatch to.');
        return;
      }

      const res = await fetch(`/api/admin/flywheel/campaigns/${campaignId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds })
      });

      const data = await res.json();
      if (data.success) {
        alert('Campaign dispatched to queue! The Cron job will process it.');
        fetchCampaigns();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      alert('Failed to dispatch campaign');
    }
  };

  return (
    <main style={{ padding: 40, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: 'var(--text)' }}>Marketing Campaigns</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>Create and dispatch automated email sequences using raw SMTP.</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          style={{ 
            display: 'flex', alignItems: 'center', gap: 8, 
            background: 'var(--primary)', color: 'white', 
            padding: '10px 20px', borderRadius: 8, 
            fontWeight: 600, border: 'none', cursor: 'pointer'
          }}
        >
          {showForm ? <IconList size={18} /> : <IconPlus size={18} />}
          {showForm ? 'View Campaigns' : 'New Campaign'}
        </button>
      </div>

      {showForm ? (
        <div style={{ background: 'var(--card-bg)', padding: 30, borderRadius: 12, border: '1px solid var(--border)' }}>
          <h2 style={{ marginTop: 0, color: 'var(--text)' }}>Create New Campaign</h2>
          <form onSubmit={handleCreateCampaign} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: 'var(--text)' }}>Internal Campaign Name</label>
              <input 
                required 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)' }}
                placeholder="e.g. Q3 Reactivation Blast"
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: 'var(--text)' }}>Email Subject Line</label>
              <input 
                required 
                value={subject} 
                onChange={(e) => setSubject(e.target.value)} 
                style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)' }}
                placeholder="e.g. Exclusive offer inside"
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: 'var(--text)' }}>HTML Content</label>
              <textarea 
                required 
                value={contentHtml} 
                onChange={(e) => setContentHtml(e.target.value)} 
                style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', minHeight: 200 }}
                placeholder="<p>Hello there...</p>"
              />
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                This HTML will automatically be wrapped in the premium Catalyst branded layout.
              </p>
            </div>
            <button 
              type="submit" 
              disabled={creating}
              style={{ background: 'var(--primary)', color: 'white', padding: '14px 20px', borderRadius: 8, fontWeight: 700, border: 'none', cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.7 : 1 }}
            >
              {creating ? 'Saving...' : 'Save Draft Campaign'}
            </button>
          </form>
        </div>
      ) : (
        <div style={{ background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: 12, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Campaign Name</th>
                <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: 12, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Status</th>
                <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: 12, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Leads Queued</th>
                <th style={{ padding: '16px 20px', textAlign: 'right', fontSize: 12, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading campaigns...</td></tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <IconTrendUp size={48} style={{ opacity: 0.2, marginBottom: 16, display: 'block', margin: '0 auto' }} />
                    No campaigns found.
                  </td>
                </tr>
              ) : (
                campaigns.map((camp) => (
                  <tr key={camp.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--text)' }}>{camp.name}</td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ 
                        background: camp.status === 'ACTIVE' ? '#D1FAE5' : '#F3F4F6', 
                        color: camp.status === 'ACTIVE' ? '#065F46' : '#374151', 
                        padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 
                      }}>
                        {camp.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', color: 'var(--text-muted)' }}>{camp._count?.leads || 0}</td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      {camp.status === 'DRAFT' && (
                        <button 
                          onClick={() => handleDispatch(camp.id)}
                          style={{ background: '#10B981', color: 'white', border: 'none', padding: '6px 14px', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Dispatch to All
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
