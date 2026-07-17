'use client';

import { useState, useEffect } from 'react';
import { RippleNexusShell } from '@/components/shells/RippleNexusShell';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { Briefcase, Building2, User, Mail, Sparkles, AlertCircle } from 'lucide-react';

export default function RnNewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [templatesByCat, setTemplatesByCat] = useState<Record<string, any[]>>({});
  
  const [formData, setFormData] = useState({
    clientName: '',
    companyName: '',
    clientEmail: '',
    clientPhone: '',
    serviceTemplateId: '',
    invoiceDueDate: '', // unused in backend for now, but keeping in state
    expectedDeliveryAt: '',
    sendInvite: true,
  });

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch the 112+ premium service templates instead of the old modules
    fetch('/api/rn/templates')
      .then(r => r.json())
      .then(data => {
        if (data.templates) setTemplatesByCat(data.templates);
      })
      .catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/rn/projects/create-from-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const resData = await res.json();
      if (res.ok && resData.data) {
        // Successfully created! Redirecting to the project page
        router.push(`/rn/projects/${resData.data.id}`);
      } else {
        setError(resData.error || 'Failed to instantiate project');
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError('An unexpected error occurred.');
      setLoading(false);
    }
  };

  return (
    <RippleNexusShell>
      <main className="rn-page" style={{ 
        maxWidth: 1000, 
        margin: '0 auto', 
        padding: '40px 24px',
        animation: 'fadeIn 0.5s ease'
      }}>
        
        {/* Header Section */}
        <div style={{ marginBottom: 40, textAlign: 'center' }}>
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center',
            gap: 8, 
            padding: '8px 16px',
            background: 'rgba(59, 130, 246, 0.1)',
            borderRadius: 20,
            color: '#3B82F6',
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 16
          }}>
            <Sparkles size={16} /> Enterprise Onboarding
          </div>
          <h1 style={{ 
            fontSize: 36, 
            fontWeight: 800, 
            color: 'var(--text-primary)', 
            letterSpacing: '-0.02em',
            marginBottom: 12
          }}>
            Instantiate Client Workspace
          </h1>
          <p style={{ 
            fontSize: 16, 
            color: 'var(--text-secondary)',
            maxWidth: 600,
            margin: '0 auto',
            lineHeight: 1.5
          }}>
            Provision a dedicated project portal, instantly clone the blueprint's milestones, and dispatch a branded welcome sequence to your client.
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#EF4444',
            padding: '16px 20px',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 32,
            fontWeight: 500
          }}>
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
          gap: 32 
        }}>
          
          {/* Left Column: Client Identity */}
          <div style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: 32,
            boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: 'linear-gradient(90deg, #3B82F6, #8B5CF6)'
            }} />
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
              <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: 10, borderRadius: 12, color: '#3B82F6' }}>
                <User size={24} />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Client Identity</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Primary Contact Name <span style={{color: '#EF4444'}}>*</span></label>
                <input 
                  type="text" required 
                  placeholder="e.g. John Doe"
                  className="input" 
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 15, transition: 'all 0.2s' }}
                  value={formData.clientName} onChange={e => setFormData({...formData, clientName: e.target.value})}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Email Address <span style={{color: '#EF4444'}}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <input 
                    type="email" required 
                    placeholder="john@example.com"
                    className="input" 
                    style={{ width: '100%', padding: '12px 16px 12px 44px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 15, transition: 'all 0.2s' }}
                    value={formData.clientEmail} onChange={e => setFormData({...formData, clientEmail: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Phone Number <span style={{color: '#EF4444'}}>*</span></label>
                <PhoneInput
                  country={'us'}
                  value={formData.clientPhone}
                  onChange={phone => setFormData({...formData, clientPhone: phone})}
                  inputStyle={{ width: '100%', padding: '12px 16px', paddingLeft: '52px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', height: '48px', fontSize: '15px' }}
                  buttonStyle={{ borderRadius: '12px 0 0 12px', border: '1px solid var(--border)', background: 'var(--surface-3)', paddingLeft: 8 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Company / Organization (Optional)</label>
                <div style={{ position: 'relative' }}>
                  <Building2 size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <input 
                    type="text" 
                    placeholder="e.g. Acme Corp"
                    className="input" 
                    style={{ width: '100%', padding: '12px 16px 12px 44px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 15, transition: 'all 0.2s' }}
                    value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Blueprint Configuration */}
          <div style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: 32,
            boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
              <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: 10, borderRadius: 12, color: '#8B5CF6' }}>
                <Briefcase size={24} />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Blueprint Configuration</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, flex: 1 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Service Blueprint (Template) <span style={{color: '#EF4444'}}>*</span></label>
                <select 
                  required 
                  className="input" 
                  style={{ 
                    width: '100%', 
                    padding: '12px 16px', 
                    borderRadius: 12, 
                    border: '2px solid #E2E8F0', 
                    background: 'var(--surface-2)', 
                    fontSize: 15,
                    cursor: 'pointer',
                    fontWeight: 500,
                    color: 'var(--text-primary)'
                  }}
                  value={formData.serviceTemplateId} onChange={e => setFormData({...formData, serviceTemplateId: e.target.value})}
                >
                  <option value="" disabled>Select a premium service blueprint...</option>
                  {Object.keys(templatesByCat).map(category => (
                    <optgroup key={category} label={category} style={{ fontWeight: 700, background: 'var(--surface-3)', color: 'var(--text-secondary)' }}>
                      {templatesByCat[category].map(t => (
                        <option key={t.id} value={t.id} style={{ fontWeight: 500, background: 'var(--surface-1)', color: 'var(--text-primary)' }}>
                          {t.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                  This automatically provisions the required milestones, tasks, and deliverables.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Target Deadline (Optional)</label>
                <input 
                  type="date" 
                  className="input" 
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 15 }}
                  value={formData.expectedDeliveryAt} onChange={e => setFormData({...formData, expectedDeliveryAt: e.target.value})}
                />
              </div>

              {/* Automation Toggle */}
              <div style={{
                marginTop: 'auto',
                background: formData.sendInvite ? 'rgba(16, 185, 129, 0.05)' : 'var(--surface-2)',
                border: formData.sendInvite ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border)',
                padding: 20,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }} onClick={() => setFormData({ ...formData, sendInvite: !formData.sendInvite })}>
                <input
                  type="checkbox"
                  checked={formData.sendInvite}
                  onChange={e => setFormData({ ...formData, sendInvite: e.target.checked })}
                  style={{ width: 20, height: 20, accentColor: '#10B981', marginTop: 2, cursor: 'pointer' }}
                />
                <div>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: formData.sendInvite ? '#059669' : 'var(--text-primary)' }}>
                    Automated Welcome Sequence
                  </h4>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Instantly email the client their secure portal invite, login token, and onboarding documentation.
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Bottom Action Bar */}
          <div style={{ 
            gridColumn: '1 / -1',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '24px 32px',
            background: 'var(--surface-1)',
            borderRadius: 20,
            border: '1px solid var(--border)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
          }}>
            <button 
              type="button" 
              onClick={() => router.back()} 
              className="btn-secondary" 
              style={{ padding: '12px 24px', borderRadius: 12, fontWeight: 600, fontSize: 15 }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading} 
              style={{ 
                padding: '14px 32px', 
                borderRadius: 12, 
                fontWeight: 700, 
                fontSize: 16,
                background: loading ? '#94A3B8' : 'linear-gradient(90deg, #3B82F6, #8B5CF6)',
                color: '#fff',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                boxShadow: loading ? 'none' : '0 10px 25px -5px rgba(59, 130, 246, 0.5)',
                transition: 'all 0.2s ease'
              }}
            >
              {loading ? (
                <>Provisioning Workspace...</>
              ) : (
                <>
                  {formData.sendInvite ? 'Instantiate & Send Invite' : 'Instantiate Workspace'}
                  <Sparkles size={18} />
                </>
              )}
            </button>
          </div>

        </form>

      </main>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .input:focus {
          outline: none;
          border-color: #3B82F6 !important;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
      `}} />
    </RippleNexusShell>
  );
}
