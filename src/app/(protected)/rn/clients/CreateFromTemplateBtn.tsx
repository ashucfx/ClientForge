'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';

export function CreateFromTemplateBtn({ templates }: { templates: any[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [formData, setFormData] = useState({
    serviceTemplateId: templates[0]?.id || '',
    clientName: '',
    clientEmail: '',
    companyName: '',
    clientPhone: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/rn/projects/create-from-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        alert('Failed to instantiate template');
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <>
      <button 
        onClick={() => setOpen(true)}
        style={{ padding: '10px 20px', fontSize: 13, background: '#10B981', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
      >
        ✨ Create from Template
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: 32, borderRadius: 16, width: 500, maxWidth: '90%' }}>
            <h2 style={{ margin: '0 0 24px', fontSize: 20 }}>Instantiate Project</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Select Template</label>
                <select 
                  required 
                  value={formData.serviceTemplateId} 
                  onChange={e => setFormData({...formData, serviceTemplateId: e.target.value})}
                  style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #CBD5E1' }}
                >
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Client Name</label>
                <input required value={formData.clientName} onChange={e => setFormData({...formData, clientName: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #CBD5E1' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Client Email</label>
                <input type="email" required value={formData.clientEmail} onChange={e => setFormData({...formData, clientEmail: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #CBD5E1' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Company (Optional)</label>
                <input value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #CBD5E1' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Phone Number *</label>
                <PhoneInput
                  country={'us'}
                  value={formData.clientPhone}
                  onChange={phone => setFormData({...formData, clientPhone: phone})}
                  inputStyle={{ width: '100%', padding: '10px 14px', paddingLeft: '48px', borderRadius: 6, border: '1px solid #CBD5E1', height: '40px', fontSize: '13px' }}
                  buttonStyle={{ borderRadius: '6px 0 0 6px', border: '1px solid #CBD5E1', background: '#F8FAFC' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button disabled={loading} type="submit" style={{ flex: 1, padding: 10, background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
                  {loading ? 'Creating...' : 'Instantiate'}
                </button>
                <button type="button" onClick={() => setOpen(false)} style={{ padding: 10, background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
