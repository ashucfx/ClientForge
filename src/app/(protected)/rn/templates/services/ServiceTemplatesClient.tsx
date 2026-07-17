'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type ServiceTemplate = any;

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
  
  const [editingMeta, setEditingMeta] = useState<ServiceTemplate | null>(null);
  const [metaJson, setMetaJson] = useState<string>('');
  const [savingMeta, setSavingMeta] = useState(false);

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
        const data = await res.json();
        setTemplates([data.data, ...templates]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openMetaEditor = (t: ServiceTemplate) => {
    setEditingMeta(t);
    const defaultMeta = {
      timeline: '4-6 weeks',
      revisionPolicy: 'Up to 2 major revisions included.',
      documentsRequired: ['Brand Guidelines', 'API Keys'],
      dependencies: ['Client Approval on Design', 'Server Access'],
      clientResponsibilities: ['Provide timely feedback', 'Supply copy'],
      teamResponsibilities: ['Daily updates', 'Code delivery'],
      qualityChecklist: ['Lighthouse score > 90', '0 TypeScript Errors'],
      estimatedEffortHours: 120,
      automationRules: { onComplete: 'send_feedback_email', defaultFolders: ['Design', 'Code', 'Invoices'] }
    };
    setMetaJson(JSON.stringify(t.meta || defaultMeta, null, 2));
  };

  const saveMeta = async () => {
    if (!editingMeta) return;
    setSavingMeta(true);
    try {
      const parsedMeta = JSON.parse(metaJson);
      const res = await fetch(`/api/rn/admin/templates/services/${editingMeta.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meta: parsedMeta }),
      });
      if (res.ok) {
        setTemplates(templates.map(t => t.id === editingMeta.id ? { ...t, meta: parsedMeta } : t));
        setEditingMeta(null);
      } else {
        alert('Failed to save configuration');
      }
    } catch (e) {
      alert('Invalid JSON formatting.');
    } finally {
      setSavingMeta(false);
    }
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Active Templates</h2>
        <button 
          onClick={() => setIsCreating(true)}
          style={{ background: 'var(--rn-primary, #0F172A)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
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

      {/* Advanced Configuration Modal */}
      {editingMeta && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: '100%', maxWidth: 700, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Advanced Configuration ({editingMeta.name})</h3>
              <button onClick={() => setEditingMeta(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 20 }}>&times;</button>
            </div>
            <p style={{ fontSize: 13, color: '#64748B', marginTop: 0 }}>Define deliverables, dependencies, team responsibilities, and automation rules in JSON format.</p>
            <textarea
              value={metaJson}
              onChange={e => setMetaJson(e.target.value)}
              style={{ flex: 1, minHeight: 300, fontFamily: 'monospace', fontSize: 13, padding: 12, border: '1px solid #CBD5E1', borderRadius: 6, marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditingMeta(null)} style={{ background: '#F1F5F9', color: '#475569', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={saveMeta} disabled={savingMeta} style={{ background: '#3B82F6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                {savingMeta ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
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
               <button onClick={() => openMetaEditor(t)} style={{ flex: 1, padding: 8, background: '#10B981', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Advanced Config</button>
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
