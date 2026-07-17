'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Settings, Plus, X, Tag, Code, Zap, ChevronRight, FileText } from 'lucide-react';

const COMMON_TRIGGERS = [
  'WELCOME_EMAIL',
  'INVOICE_CREATED',
  'INVOICE_PAID',
  'MILESTONE_COMPLETED',
  'PROJECT_DELIVERED',
  'NEW_MESSAGE',
  'PORTAL_INVITE',
  'CUSTOM'
];

export default function EmailTemplatesClient({ initialTemplates }: { initialTemplates: any[] }) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);
  const [editing, setEditing] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    triggerEvent: '',
    customTriggerEvent: '',
    subject: '',
    htmlBody: '',
    availableVariablesString: 'clientName, projectName', // Comma separated string for UX
  });

  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const finalTrigger = formData.triggerEvent === 'CUSTOM' ? formData.customTriggerEvent : formData.triggerEvent;
      
      // Parse comma separated string into JSON array
      const variablesArray = formData.availableVariablesString
        .split(',')
        .map(v => v.trim())
        .filter(v => v.length > 0);

      const res = await fetch('/api/rn/admin/templates/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          triggerEvent: finalTrigger,
          subject: formData.subject,
          htmlBody: formData.htmlBody,
          availableVariables: variablesArray
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
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to save template');
      }
    } catch (err) {
      console.error(err);
      alert('An unexpected error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  const openEditor = (t?: any) => {
    if (t) {
      const isCustom = !COMMON_TRIGGERS.includes(t.triggerEvent) && t.triggerEvent !== 'CUSTOM';
      setFormData({
        triggerEvent: isCustom ? 'CUSTOM' : t.triggerEvent,
        customTriggerEvent: isCustom ? t.triggerEvent : '',
        subject: t.subject,
        htmlBody: t.htmlBody,
        availableVariablesString: (t.availableVariables || []).join(', '),
      });
      setEditing(t.id);
    } else {
      setFormData({
        triggerEvent: 'WELCOME_EMAIL',
        customTriggerEvent: '',
        subject: 'Welcome to your project',
        htmlBody: 'Hi {{clientName}},<br/><br/>Welcome aboard!',
        availableVariablesString: 'clientName, projectName',
      });
      setEditing('new');
    }
  };

  const filteredTemplates = templates.filter(t => t.subject.toLowerCase().includes(search.toLowerCase()) || t.triggerEvent.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ animation: 'fadeIn 0.5s ease', marginTop: 24 }}>
      
      {!editing ? (
        <>
          {/* Top Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, gap: 16, flexWrap: 'wrap' }}>
            <input 
              type="search" 
              placeholder="Search templates..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input"
              style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-1)', width: '100%', maxWidth: 400, fontSize: 14 }}
            />
            <button 
              onClick={() => openEditor()}
              style={{ 
                background: 'linear-gradient(90deg, #10B981, #059669)', 
                color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 12, cursor: 'pointer', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 16px -4px rgba(16, 185, 129, 0.4)', transition: 'all 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'none'}
            >
              <Plus size={18} /> New Email Template
            </button>
          </div>

          {/* Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 24 }}>
            {filteredTemplates.map(t => (
              <div key={t.id} style={{ 
                background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 20, 
                padding: 24, boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden',
                display: 'flex', flexDirection: 'column'
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #10B981, #3B82F6)' }} />
                
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, marginTop: 4 }}>
                  <div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,0.1)', padding: '4px 10px', borderRadius: 99, marginBottom: 12 }}>
                      <Zap size={12} fill="#10B981" /> {t.triggerEvent}
                    </div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Mail size={18} color="#94A3B8" /> {t.subject}
                    </h3>
                  </div>
                </div>

                <div style={{ background: 'var(--surface-2)', padding: '16px', borderRadius: 12, marginBottom: 24, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Code size={14} /> Available Variables
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {Array.isArray(t.availableVariables) && t.availableVariables.length > 0 ? (
                      t.availableVariables.map((v: string) => (
                        <span key={v} style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: 6, fontSize: 12, fontFamily: 'monospace' }}>
                          {`{{${v}}}`}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>No variables defined</span>
                    )}
                  </div>
                </div>

                <button onClick={() => openEditor(t)} style={{ width: '100%', padding: '12px', background: 'var(--surface-2)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s' }} onMouseOver={e=>e.currentTarget.style.background='var(--surface-3)'} onMouseOut={e=>e.currentTarget.style.background='var(--surface-2)'}>
                  <Settings size={16} /> Edit Template
                </button>
              </div>
            ))}

            {filteredTemplates.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 80, background: 'var(--surface-1)', borderRadius: 24, border: '2px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ background: 'var(--surface-2)', padding: 16, borderRadius: '50%', color: 'var(--text-tertiary)', marginBottom: 16 }}>
                  <Mail size={32} />
                </div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: 18, color: 'var(--text-primary)' }}>No templates found</h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>Create a new email template for automated client communication.</p>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Editor Mode */
        <div style={{ background: 'var(--surface-1)', padding: 0, borderRadius: 24, border: '1px solid var(--border)', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: 10, borderRadius: 12, color: '#10B981' }}><FileText size={20} /></div>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{editing === 'new' ? 'Compose New' : 'Edit'} Email Template</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>Design automated communication dispatched on triggers.</p>
              </div>
            </div>
            <button type="button" onClick={() => setEditing(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 8, borderRadius: 8 }}>
              <X size={20} />
            </button>
          </div>
          
          <form onSubmit={handleSave} style={{ padding: 32 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>System Trigger Event <span style={{color: '#EF4444'}}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <Zap size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <select 
                    required 
                    value={formData.triggerEvent} 
                    onChange={e => setFormData({...formData, triggerEvent: e.target.value})} 
                    style={{ width: '100%', padding: '12px 16px 12px 40px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 14, fontWeight: 500 }}
                  >
                    <option value="" disabled>Select a trigger event...</option>
                    {COMMON_TRIGGERS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {formData.triggerEvent === 'CUSTOM' && (
                <div style={{ animation: 'fadeIn 0.3s ease' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Custom Trigger Name <span style={{color: '#EF4444'}}>*</span></label>
                  <input 
                    required 
                    value={formData.customTriggerEvent} 
                    onChange={e => setFormData({...formData, customTriggerEvent: e.target.value})} 
                    style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 14 }} 
                    placeholder="e.g. REPORT_GENERATED" 
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Email Subject <span style={{color: '#EF4444'}}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <Tag size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <input 
                    required 
                    value={formData.subject} 
                    onChange={e => setFormData({...formData, subject: e.target.value})} 
                    style={{ width: '100%', padding: '12px 16px 12px 40px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 14 }} 
                    placeholder="Subject line..."
                  />
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Dynamic Variables (Comma Separated)</label>
                <div style={{ position: 'relative' }}>
                  <Code size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <input 
                    required 
                    value={formData.availableVariablesString} 
                    onChange={e => setFormData({...formData, availableVariablesString: e.target.value})} 
                    style={{ width: '100%', padding: '12px 16px 12px 40px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 14, fontFamily: 'monospace' }} 
                    placeholder="clientName, magicLink, amount"
                  />
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>Use these in the body below like <code style={{background: 'var(--surface-3)', padding: '2px 4px', borderRadius: 4}}>{"{{variable}}"}</code></p>
              </div>
            </div>

            <div style={{ marginBottom: 32 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>HTML Body <span style={{color: '#EF4444'}}>*</span></label>
              <textarea 
                required 
                rows={12} 
                value={formData.htmlBody} 
                onChange={e => setFormData({...formData, htmlBody: e.target.value})} 
                style={{ width: '100%', padding: '16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 14, fontFamily: 'monospace', lineHeight: 1.5, resize: 'vertical' }} 
                placeholder="<html><body>Hello {{clientName}}...</body></html>"
              />
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 24, borderTop: '1px solid var(--border)' }}>
              <button type="button" onClick={() => setEditing(null)} style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '12px 24px', borderRadius: 12, cursor: 'pointer', fontWeight: 600 }}>Discard</button>
              <button type="submit" disabled={saving} style={{ background: 'linear-gradient(90deg, #10B981, #059669)', color: '#fff', border: 'none', padding: '12px 32px', borderRadius: 12, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 16px -4px rgba(16, 185, 129, 0.4)' }}>
                {saving ? 'Committing...' : 'Commit Template'}
              </button>
            </div>
          </form>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
