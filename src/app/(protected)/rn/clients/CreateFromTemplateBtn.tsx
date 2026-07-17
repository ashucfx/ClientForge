'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { Sparkles, User, Mail, Building2, Briefcase, X } from 'lucide-react';

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
      const data = await res.json();
      if (res.ok) {
        setOpen(false);
        router.push(`/rn/projects/${data.data.id}`);
      } else {
        alert(data.error || 'Failed to provision workspace');
      }
    } catch (err) {
      alert('An unexpected error occurred.');
    }
    setLoading(false);
  };

  const inputStyle = {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    fontSize: 14,
    color: 'var(--text-primary)',
    outline: 'none'
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
          borderRadius: 10,
          cursor: 'pointer',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.35)',
          transition: 'all 0.2s ease',
          whiteSpace: 'nowrap'
        }}
      >
        <Sparkles size={15} /> Quick Provision
      </button>

      {open && (
        <div className="rn-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="rn-modal">

            {/* Header */}
            <div className="rn-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: 10, borderRadius: 12, color: '#3B82F6', flexShrink: 0 }}>
                  <Briefcase size={20} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Quick Provision</h2>
                  <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>Instantiate a client workspace from a blueprint instantly.</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 8, borderRadius: 8, flexShrink: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Body */}
            <form onSubmit={handleSubmit}>
              <div className="rn-modal-body">
                {/* Blueprint Selector */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
                    Service Blueprint <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <select
                    required
                    value={formData.serviceTemplateId}
                    onChange={e => setFormData({ ...formData, serviceTemplateId: e.target.value })}
                    style={{ ...inputStyle, cursor: 'pointer', fontWeight: 500 }}
                  >
                    <option value="" disabled>
                      {Object.keys(templatesByCat).length === 0 ? 'No blueprints — seed templates first' : 'Select a service blueprint...'}
                    </option>
                    {Object.keys(templatesByCat).map(category => (
                      <optgroup key={category} label={`── ${category} ──`}>
                        {templatesByCat[category].map((t: any) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {/* 2-col grid */}
                <div className="rn-form-2col" style={{ marginBottom: 20 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
                      Client Name <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <User size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                      <input required value={formData.clientName} onChange={e => setFormData({ ...formData, clientName: e.target.value })} style={{ ...inputStyle, paddingLeft: 36 }} placeholder="John Doe" />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
                      Client Email <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                      <input type="email" required value={formData.clientEmail} onChange={e => setFormData({ ...formData, clientEmail: e.target.value })} style={{ ...inputStyle, paddingLeft: 36 }} placeholder="john@example.com" />
                    </div>
                  </div>
                </div>

                <div className="rn-form-2col" style={{ marginBottom: 20 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Company (Optional)</label>
                    <div style={{ position: 'relative' }}>
                      <Building2 size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                      <input value={formData.companyName} onChange={e => setFormData({ ...formData, companyName: e.target.value })} style={{ ...inputStyle, paddingLeft: 36 }} placeholder="Acme Corp" />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
                      Phone Number <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <PhoneInput
                      country={'in'}
                      value={formData.clientPhone}
                      onChange={phone => setFormData({ ...formData, clientPhone: phone })}
                      inputStyle={{ width: '100%', padding: '11px 14px', paddingLeft: '48px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', height: '43px', fontSize: '14px' }}
                      buttonStyle={{ borderRadius: '10px 0 0 10px', border: '1px solid var(--border)', background: 'var(--surface-3)' }}
                    />
                  </div>
                </div>

                {/* Send invite toggle */}
                <div
                  style={{
                    background: formData.sendInvite ? 'rgba(16, 185, 129, 0.05)' : 'var(--surface-2)',
                    border: formData.sendInvite ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border)',
                    padding: 16, borderRadius: 12,
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    transition: 'all 0.2s', cursor: 'pointer'
                  }}
                  onClick={() => setFormData({ ...formData, sendInvite: !formData.sendInvite })}
                >
                  <input type="checkbox" checked={formData.sendInvite} onChange={e => setFormData({ ...formData, sendInvite: e.target.checked })} style={{ width: 18, height: 18, accentColor: '#10B981', marginTop: 2, cursor: 'pointer' }} />
                  <div>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: formData.sendInvite ? '#059669' : 'var(--text-primary)' }}>Email Onboarding Invite</h4>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>Instantly deliver portal access to the client.</p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="rn-modal-footer">
                <button type="button" onClick={() => setOpen(false)} style={{ padding: '11px 20px', background: 'var(--surface-3)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 10, fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button disabled={loading} type="submit" style={{ padding: '11px 28px', background: 'linear-gradient(90deg, #3B82F6, #8B5CF6)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 6px 16px -4px rgba(59, 130, 246, 0.4)', opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Provisioning...' : <><Sparkles size={16} /> Instantiate Workspace</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
