'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function EmailTemplatesClient({ initialTemplates }: { initialTemplates: any[] }) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);
  const [editing, setEditing] = useState<any>(null);
  const [formData, setFormData] = useState({
    triggerEvent: '',
    subject: '',
    htmlBody: '',
    availableVariables: '["clientName", "projectName"]',
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/rn/admin/templates/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          availableVariables: JSON.parse(formData.availableVariables || '[]')
        }),
      });
      if (res.ok) {
        setEditing(null);
        router.refresh();
        const data = await res.json();
        setTemplates(prev => {
          const exists = prev.find(p => p.id === data.data.id);
          if (exists) return prev.map(p => p.id === data.data.id ? data.data : p);
          return [data.data, ...prev];
        });
      }
    } catch (err) {
      console.error(err);
      alert('Invalid JSON in variables array');
    }
  };

  const openEditor = (t?: any) => {
    if (t) {
      setFormData({
        triggerEvent: t.triggerEvent,
        subject: t.subject,
        htmlBody: t.htmlBody,
        availableVariables: JSON.stringify(t.availableVariables),
      });
      setEditing(t.id);
    } else {
      setFormData({
        triggerEvent: 'WELCOME_EMAIL',
        subject: 'Welcome to your project',
        htmlBody: 'Hi {{clientName}},<br/><br/>Welcome aboard!',
        availableVariables: '["clientName", "projectName"]',
      });
      setEditing('new');
    }
  };

  return (
    <div style={{ marginTop: 24 }}>
      {!editing ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
            <button onClick={() => openEditor()} className="btn-primary" style={{ padding: '8px 16px', borderRadius: 8 }}>
              + New Email Template
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {templates.map(t => (
              <div key={t.id} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 99, display: 'inline-flex', marginBottom: 8 }}>
                  {t.triggerEvent}
                </div>
                <h3 style={{ margin: '0 0 12px 0', fontSize: 16 }}>{t.subject}</h3>
                <div style={{ fontSize: 13, color: '#64748B', display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                  {Array.isArray(t.availableVariables) && t.availableVariables.map((v: string) => (
                    <span key={v} style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>{`{{${v}}}`}</span>
                  ))}
                </div>
                <button onClick={() => openEditor(t)} style={{ width: '100%', padding: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  Edit Template
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <form onSubmit={handleSave} style={{ background: '#fff', padding: 24, borderRadius: 12, border: '1px solid #E2E8F0' }}>
          <h3 style={{ margin: '0 0 20px 0' }}>{editing === 'new' ? 'Create' : 'Edit'} Email Template</h3>
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Trigger Event (Unique ID)</label>
              <input required value={formData.triggerEvent} onChange={e => setFormData({...formData, triggerEvent: e.target.value})} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #CBD5E1' }} placeholder="e.g. INVOICE_CREATED" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Subject Line</label>
              <input required value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #CBD5E1' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Available Variables (JSON Array)</label>
              <input required value={formData.availableVariables} onChange={e => setFormData({...formData, availableVariables: e.target.value})} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #CBD5E1', fontFamily: 'monospace' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>HTML Body</label>
              <textarea required rows={10} value={formData.htmlBody} onChange={e => setFormData({...formData, htmlBody: e.target.value})} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #CBD5E1', fontFamily: 'monospace' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button type="submit" className="btn-primary" style={{ padding: '8px 24px', borderRadius: 6 }}>Save</button>
            <button type="button" onClick={() => setEditing(null)} style={{ background: '#F1F5F9', color: '#475569', border: 'none', padding: '8px 24px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
