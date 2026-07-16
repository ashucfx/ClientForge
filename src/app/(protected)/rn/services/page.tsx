'use client';

import { useState, useEffect } from 'react';
import { RippleNexusShell } from '@/components/shells/RippleNexusShell';
import { IconSettings, IconTarget } from '@/components/Icons';

type ServiceModule = {
  id?: string;
  slug: string;
  name: string;
  workflowStages: string[];
  revisionLimit: number;
  revisionCharge: number;
  defaultSlaDays: number;
  isActive: boolean;
};

export default function RnServicesPage() {
  const [services, setServices] = useState<ServiceModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ServiceModule | null>(null);
  const [formData, setFormData] = useState<ServiceModule | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rn/services');
      const data = await res.json();
      setServices(data.services || []);
    } catch (e) {
      setError('Failed to fetch services');
    }
    setLoading(false);
  };

  const handleSelect = (srv: ServiceModule) => {
    setSelected(srv);
    setFormData({ ...srv });
    setError('');
  };

  const handleCreateNew = () => {
    setSelected(null);
    setFormData({
      slug: '',
      name: '',
      workflowStages: ['DISCOVERY', 'DEVELOPMENT', 'DELIVERY'],
      revisionLimit: 3,
      revisionCharge: 0,
      defaultSlaDays: 30,
      isActive: true,
    });
    setError('');
  };

  const handleSave = async () => {
    if (!formData) return;
    setSaving(true);
    setError('');
    try {
      const isNew = !formData.id;
      const res = await fetch('/api/rn/services', {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      await fetchServices();
      handleSelect(data.service);
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  };

  return (
    <RippleNexusShell>
      <div className="page-header" style={{ paddingBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title" style={{ color: '#7C5CFF' }}>Service Modules</h1>
            <p className="page-subtitle">Configure B2B Agency Services & Workflows</p>
          </div>
          <button className="btn btn-primary" onClick={handleCreateNew} style={{ background: '#7C5CFF', borderColor: '#7C5CFF' }}>
            + New Service
          </button>
        </div>
      </div>

      <div className="page-body" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, alignItems: 'start' }}>
        
        {/* Left: List */}
        <div className="card" style={{ padding: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>Available Services</h2>
          {loading ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading...</div>
          ) : services.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>No services configured.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {services.map(s => (
                <button
                  key={s.id}
                  onClick={() => handleSelect(s)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    background: selected?.id === s.id ? 'var(--brand-light)' : '#fff',
                    border: `1px solid ${selected?.id === s.id ? '#7C5CFF' : 'var(--border)'}`,
                    transition: 'all 0.15s'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: selected?.id === s.id ? '#7C5CFF' : 'var(--text)' }}>
                      {s.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>/{s.slug}</div>
                  </div>
                  {!s.isActive && <span style={{ fontSize: 10, background: 'var(--danger-bg)', color: 'var(--danger)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>INACTIVE</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Form */}
        {formData ? (
          <div className="card" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconTarget size={20} style={{ color: '#7C5CFF' }} />
              {formData.id ? 'Edit Service' : 'Create New Service'}
            </h2>

            {error && <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 20, fontWeight: 600 }}>{error}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Service Name</label>
                <input className="input" type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Website Development" />
              </div>
              
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Slug</label>
                <input className="input" type="text" value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} placeholder="e.g. web_development" />
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Unique identifier used for URLs and logic.</div>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Workflow Stages (Comma Separated)</label>
                <input className="input" type="text" value={formData.workflowStages.join(', ')} onChange={e => setFormData({...formData, workflowStages: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})} placeholder="DISCOVERY, DESIGN, DEVELOPMENT, LAUNCH" />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Revision Limit</label>
                <input className="input" type="number" value={formData.revisionLimit} onChange={e => setFormData({...formData, revisionLimit: Number(e.target.value)})} />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Revision Charge (INR)</label>
                <input className="input" type="number" value={formData.revisionCharge} onChange={e => setFormData({...formData, revisionCharge: Number(e.target.value)})} />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Default SLA (Days)</label>
                <input className="input" type="number" value={formData.defaultSlaDays} onChange={e => setFormData({...formData, defaultSlaDays: Number(e.target.value)})} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, gridColumn: '1 / -1', marginTop: 10 }}>
                <input type="checkbox" id="isActive" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} style={{ width: 16, height: 16, accentColor: '#7C5CFF' }} />
                <label htmlFor="isActive" style={{ fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Active (Visible in Invoice Creator)</label>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ background: '#7C5CFF', borderColor: '#7C5CFF' }}>
                {saving ? 'Saving...' : 'Save Service'}
              </button>
            </div>
          </div>
        ) : (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 64, color: 'var(--muted)', textAlign: 'center' }}>
            <IconSettings size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: 'var(--text)' }}>No Service Selected</h3>
            <p style={{ fontSize: 13, margin: 0, maxWidth: 300 }}>Select a service from the left to configure its workflow stages and pricing policies, or create a new one.</p>
          </div>
        )}
      </div>
    </RippleNexusShell>
  );
}
