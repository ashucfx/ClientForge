'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type ServiceTemplate = any; // We can type this out fully later

export default function ServiceTemplatesClient({ initialTemplates }: { initialTemplates: ServiceTemplate[] }) {
  const router = useRouter();
  const [templates, setTemplates] = useState<ServiceTemplate[]>(initialTemplates);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: 'Software Development',
    pricingModel: 'FIXED',
    baseCurrency: 'USD',
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/rn/admin/templates/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setIsCreating(false);
        router.refresh();
        // Optimistically update
        const data = await res.json();
        setTemplates([data.data, ...templates]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Active Templates</h2>
        <button 
          onClick={() => setIsCreating(true)}
          style={{
            background: 'var(--rn-primary, #0F172A)', color: '#fff', border: 'none',
            padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600
          }}
        >
          + New Template
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} style={{ background: '#fff', padding: 24, borderRadius: 12, border: '1px solid #E2E8F0', marginBottom: 24 }}>
          <h3 style={{ marginTop: 0, marginBottom: 16 }}>Create Service Template</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Template Name</label>
              <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #CBD5E1' }} placeholder="e.g. AI Chatbot Core" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Category</label>
              <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #CBD5E1' }}>
                <option>Software Development</option>
                <option>AI Services</option>
                <option>Marketing</option>
                <option>UI/UX Design</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Pricing Model</label>
              <select value={formData.pricingModel} onChange={e => setFormData({...formData, pricingModel: e.target.value})} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #CBD5E1' }}>
                <option>FIXED</option>
                <option>HOURLY</option>
                <option>MONTHLY</option>
                <option>MILESTONE</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Base Currency</label>
              <select value={formData.baseCurrency} onChange={e => setFormData({...formData, baseCurrency: e.target.value})} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #CBD5E1' }}>
                <option>USD</option>
                <option>INR</option>
                <option>EUR</option>
                <option>GBP</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit" style={{ background: '#3B82F6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Save Template</button>
            <button type="button" onClick={() => setIsCreating(false)} style={{ background: '#F1F5F9', color: '#475569', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
          </div>
        </form>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
        {templates.map(t => (
          <div key={t.id} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#3B82F6', background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: 99 }}>{t.category}</span>
                <h3 style={{ margin: '8px 0 4px 0', fontSize: 18, color: '#0F172A' }}>{t.name}</h3>
                <div style={{ fontSize: 12, color: '#64748B' }}>Version {t.version}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#475569', marginBottom: 16 }}>
              <div><strong>Model:</strong> {t.pricingModel}</div>
              <div><strong>Currency:</strong> {t.baseCurrency}</div>
            </div>
            <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 16, display: 'flex', gap: 16, fontSize: 13, color: '#64748B' }}>
              <div>{t.milestoneTemplates?.length || 0} Milestones</div>
              <div>{t.deliverableTemplates?.length || 0} Deliverables</div>
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
               <button style={{ flex: 1, padding: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Edit Details</button>
               <button style={{ flex: 1, padding: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Manage Milestones</button>
            </div>
          </div>
        ))}
        {templates.length === 0 && !isCreating && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 60, background: '#F8FAFC', borderRadius: 12, border: '1px dashed #CBD5E1' }}>
            <p style={{ color: '#64748B' }}>No service templates found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
