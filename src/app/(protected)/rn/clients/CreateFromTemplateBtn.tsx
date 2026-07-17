'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { Sparkles, User, Mail, Building2, Phone, Briefcase, X } from 'lucide-react';

export function CreateFromTemplateBtn({ templates }: { templates: any[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [formData, setFormData] = useState({
    serviceTemplateId: '',
    clientName: '',
    clientEmail: '',
    companyName: '',
    clientPhone: '',
    sendInvite: true
  });

  // Group templates by category
  const templatesByCat = templates.reduce((acc: any, t: any) => {
    const cat = t.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

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
        const errorData = await res.json();
        alert(errorData.error || 'Failed to instantiate template');
      }
    } catch (err) {
      console.error(err);
      alert('An unexpected error occurred.');
    }
    setLoading(false);
  };

  return (
    <>
      <button 
        onClick={() => setOpen(true)}
        style={{ 
          padding: '10px 20px', 
          fontSize: 13, 
          background: 'linear-gradient(90deg, #10B981, #059669)', 
          color: '#fff', 
          border: 'none', 
          borderRadius: 8, 
          cursor: 'pointer', 
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.39)',
          transition: 'all 0.2s ease'
        }}
        onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
        onMouseOut={e => e.currentTarget.style.transform = 'none'}
      >
        <Sparkles size={16} /> Instant Provision
      </button>

      {open && (
        <div style={{ 
          position: 'fixed', inset: 0, 
          background: 'rgba(15, 23, 42, 0.6)', 
          backdropFilter: 'blur(8px)',
          zIndex: 9999, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{ 
            background: 'var(--surface-1)', 
            padding: 0, 
            borderRadius: 24, 
            width: 600, 
            maxWidth: '95%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '90vh'
          }}>
            
            {/* Header */}
            <div style={{ 
              padding: '24px 32px', 
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface-2)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Briefcase size={22} color="#3B82F6" /> Quick Provision
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>Instantiate a client workspace from a blueprint instantly.</p>
              </div>
              <button 
                onClick={() => setOpen(false)} 
                style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 8, borderRadius: 8 }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--surface-3)'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Form */}
            <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '32px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Service Blueprint <span style={{color: '#EF4444'}}>*</span></label>
                  <select 
                    required 
                    value={formData.serviceTemplateId} 
                    onChange={e => setFormData({...formData, serviceTemplateId: e.target.value})}
                    style={{ 
                      width: '100%', padding: '12px 16px', borderRadius: 12, 
                      border: '2px solid #E2E8F0', background: 'var(--surface-1)', 
                      fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer'
                    }}
                  >
                    <option value="" disabled>Select a premium service blueprint...</option>
                    {Object.keys(templatesByCat).map(category => (
                      <optgroup key={category} label={category} style={{ fontWeight: 700, background: 'var(--surface-3)', color: 'var(--text-secondary)' }}>
                        {templatesByCat[category].map((t: any) => (
                          <option key={t.id} value={t.id} style={{ fontWeight: 500, background: 'var(--surface-1)', color: 'var(--text-primary)' }}>
                            {t.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Client Name <span style={{color: '#EF4444'}}>*</span></label>
                    <div style={{ position: 'relative' }}>
                      <User size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                      <input required value={formData.clientName} onChange={e => setFormData({...formData, clientName: e.target.value})} style={{ width: '100%', padding: '12px 16px 12px 40px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 14 }} placeholder="John Doe" />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Client Email <span style={{color: '#EF4444'}}>*</span></label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                      <input type="email" required value={formData.clientEmail} onChange={e => setFormData({...formData, clientEmail: e.target.value})} style={{ width: '100%', padding: '12px 16px 12px 40px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 14 }} placeholder="john@example.com" />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Company (Optional)</label>
                    <div style={{ position: 'relative' }}>
                      <Building2 size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                      <input value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} style={{ width: '100%', padding: '12px 16px 12px 40px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 14 }} placeholder="Acme Corp" />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Phone Number <span style={{color: '#EF4444'}}>*</span></label>
                    <PhoneInput
                      country={'us'}
                      value={formData.clientPhone}
                      onChange={phone => setFormData({...formData, clientPhone: phone})}
                      inputStyle={{ width: '100%', padding: '12px 16px', paddingLeft: '48px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', height: '43px', fontSize: '14px' }}
                      buttonStyle={{ borderRadius: '10px 0 0 10px', border: '1px solid var(--border)', background: 'var(--surface-3)' }}
                    />
                  </div>
                </div>

                <div style={{
                  marginTop: 8,
                  background: formData.sendInvite ? 'rgba(16, 185, 129, 0.05)' : 'var(--surface-2)',
                  border: formData.sendInvite ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border)',
                  padding: 16,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  transition: 'all 0.2s',
                  cursor: 'pointer'
                }} onClick={() => setFormData({ ...formData, sendInvite: !formData.sendInvite })}>
                  <input
                    type="checkbox"
                    checked={formData.sendInvite}
                    onChange={e => setFormData({ ...formData, sendInvite: e.target.checked })}
                    style={{ width: 18, height: 18, accentColor: '#10B981', marginTop: 2, cursor: 'pointer' }}
                  />
                  <div>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: formData.sendInvite ? '#059669' : 'var(--text-primary)' }}>Email Onboarding Invite</h4>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>Instantly deliver portal access to the client.</p>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div style={{ display: 'flex', gap: 12, marginTop: 32, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
                <button type="button" onClick={() => setOpen(false)} style={{ flex: 1, padding: '12px', background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button disabled={loading} type="submit" style={{ flex: 2, padding: '12px', background: 'linear-gradient(90deg, #3B82F6, #8B5CF6)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, boxShadow: '0 8px 16px -4px rgba(59, 130, 246, 0.4)' }}>
                  {loading ? 'Provisioning...' : 'Instantiate Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
