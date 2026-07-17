'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Settings, Plus, X, Tag, Code, Zap, FileText, Eye, Edit3, Monitor, Smartphone } from 'lucide-react';

const COMMON_TRIGGERS = [
  'WELCOME_EMAIL',
  'INVOICE_CREATED',
  'INVOICE_PAID',
  'INVOICE_REMINDER',
  'INVOICE_OVERDUE',
  'MILESTONE_COMPLETED',
  'MILESTONE_APPROVED',
  'PROJECT_STARTED',
  'PROJECT_DELIVERED',
  'PROJECT_ON_HOLD',
  'NEW_MESSAGE',
  'PORTAL_INVITE',
  'DELIVERABLE_UPLOADED',
  'REVIEW_REQUESTED',
  'FEEDBACK_REQUESTED',
  'CONTRACT_SIGNED',
  'RETAINER_RENEWAL',
  'CUSTOM'
];

export default function EmailTemplatesClient({ initialTemplates, isSuperAdmin }: { initialTemplates: any[], isSuperAdmin?: boolean }) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);
  const [editing, setEditing] = useState<any>(null);
  const [seeding, setSeeding] = useState(false);
  const [editorTab, setEditorTab] = useState<'edit' | 'preview' | 'mobile'>('edit');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    triggerEvent: '',
    customTriggerEvent: '',
    subject: '',
    htmlBody: '',
    availableVariablesString: 'clientName, projectName',
  });

  const handleSeedDefaults = async () => {
    if (!confirm('This will seed default branded email templates. Continue?')) return;
    setSeeding(true);
    try {
      const res = await fetch('/api/rn/admin/seed-email-templates', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ Seeded ${data.seeded} email templates!`);
        router.refresh();
      } else {
        alert('❌ Seed failed: ' + data.error);
      }
    } catch (e) {
      alert('❌ Network error');
    } finally {
      setSeeding(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const finalTrigger = formData.triggerEvent === 'CUSTOM' ? formData.customTriggerEvent : formData.triggerEvent;
      const variablesArray = formData.availableVariablesString
        .split(',').map(v => v.trim()).filter(v => v.length > 0);
      const res = await fetch('/api/rn/admin/templates/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggerEvent: finalTrigger, subject: formData.subject, htmlBody: formData.htmlBody, availableVariables: variablesArray }),
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates(prev => {
          const exists = prev.find(p => p.id === data.data.id);
          if (exists) return prev.map(p => p.id === data.data.id ? data.data : p);
          return [data.data, ...prev];
        });
        setEditing(null);
        router.refresh();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save');
      }
    } catch (err) {
      alert('Unexpected error');
    } finally {
      setSaving(false);
    }
  };

  const openEditor = (t?: any) => {
    setEditorTab('edit');
    if (t) {
      const isCustom = !COMMON_TRIGGERS.slice(0, -1).includes(t.triggerEvent);
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
        subject: 'Welcome to {{projectName}} — Your Portal is Ready',
        htmlBody: `<div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #0F172A; color: #E2E8F0; border-radius: 16px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #3B82F6, #8B5CF6); padding: 40px; text-align: center;">
    <h1 style="margin: 0; color: #fff; font-size: 28px; font-weight: 800;">Welcome</h1>
    <p style="color: rgba(255,255,255,0.85); margin-top: 8px;">Hi {{clientName}}, your workspace is live.</p>
  </div>
  <div style="padding: 40px;">
    <a href="{{magicLink}}" style="background: #3B82F6; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700;">Access Portal →</a>
  </div>
</div>`,
        availableVariablesString: 'clientName, projectName, magicLink',
      });
      setEditing('new');
    }
  };

  // Render preview HTML with dummy values
  const getPreviewHtml = () => {
    return formData.htmlBody
      .replace(/\{\{clientName\}\}/g, 'John Doe')
      .replace(/\{\{projectName\}\}/g, 'Enterprise AI Platform')
      .replace(/\{\{magicLink\}\}/g, '#')
      .replace(/\{\{amount\}\}/g, '₹1,20,000')
      .replace(/\{\{dueDate\}\}/g, 'August 1, 2026')
      .replace(/\{\{paymentLink\}\}/g, '#')
      .replace(/\{\{milestoneName\}\}/g, 'Phase 1 — Discovery')
      .replace(/\{\{portalLink\}\}/g, '#');
  };

  const filteredTemplates = templates.filter(t =>
    t.subject.toLowerCase().includes(search.toLowerCase()) ||
    t.triggerEvent.toLowerCase().includes(search.toLowerCase())
  );

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 12,
    border: '1px solid var(--border)', background: 'var(--surface-2)',
    fontSize: 14, color: 'var(--text-primary)', outline: 'none'
  };

  if (editing) {
    return (
      <div style={{ animation: 'fadeIn 0.3s ease' }}>
        {/* Editor Header */}
        <div style={{
          background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 20,
          marginBottom: 24, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
        }}>
          <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: 10, borderRadius: 12, color: '#10B981' }}>
                <FileText size={20} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {editing === 'new' ? 'Compose New Template' : 'Edit Template'}
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>Craft the automated email body with dynamic variables.</p>
              </div>
            </div>
            <button onClick={() => setEditing(null)} style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', padding: '8px 16px', borderRadius: 10, color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <X size={15} /> Discard
            </button>
          </div>

          {/* Meta fields */}
          <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--border)' }}>
            <div className="rn-form-2col">
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Trigger Event <span style={{ color: '#EF4444' }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <Zap size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <select required value={formData.triggerEvent} onChange={e => setFormData({ ...formData, triggerEvent: e.target.value })} style={{ ...inputStyle, paddingLeft: 36, cursor: 'pointer' }}>
                    <option value="" disabled>Select trigger...</option>
                    {COMMON_TRIGGERS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              {formData.triggerEvent === 'CUSTOM' ? (
                <div style={{ animation: 'fadeIn 0.3s ease' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Custom Trigger Name <span style={{ color: '#EF4444' }}>*</span></label>
                  <input required value={formData.customTriggerEvent} onChange={e => setFormData({ ...formData, customTriggerEvent: e.target.value })} style={inputStyle} placeholder="e.g. REPORT_READY" />
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Subject Line <span style={{ color: '#EF4444' }}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <Tag size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                    <input required value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })} style={{ ...inputStyle, paddingLeft: 36 }} placeholder="Subject line..." />
                  </div>
                </div>
              )}
            </div>
            {formData.triggerEvent === 'CUSTOM' && (
              <div style={{ marginTop: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Subject Line <span style={{ color: '#EF4444' }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <Tag size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <input required value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })} style={{ ...inputStyle, paddingLeft: 36 }} placeholder="Subject line..." />
                </div>
              </div>
            )}
            <div style={{ marginTop: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Dynamic Variables (comma-separated)</label>
              <div style={{ position: 'relative' }}>
                <Code size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                <input value={formData.availableVariablesString} onChange={e => setFormData({ ...formData, availableVariablesString: e.target.value })} style={{ ...inputStyle, paddingLeft: 36, fontFamily: 'monospace' }} placeholder="clientName, amount, dueDate" />
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
                Use in the body like <code style={{ background: 'var(--surface-3)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>{'{{variableName}}'}</code>
              </p>
            </div>
          </div>
        </div>

        {/* Editor + Preview Split */}
        <div className="rn-email-editor-layout" style={{ marginBottom: 24 }}>
          {/* Editor Panel */}
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="rn-preview-tabs">
              <button type="button" className={`rn-preview-tab${editorTab === 'edit' ? ' active' : ''}`} onClick={() => setEditorTab('edit')}>
                <Edit3 size={14} style={{ display: 'inline', marginRight: 6 }} />HTML Editor
              </button>
            </div>
            <textarea
              required
              value={formData.htmlBody}
              onChange={e => setFormData({ ...formData, htmlBody: e.target.value })}
              style={{
                flex: 1, minHeight: 480, fontFamily: '"Fira Code", "Cascadia Code", monospace', fontSize: 13,
                padding: 20, background: '#1A1D2E', color: '#A9B1D6', border: 'none',
                outline: 'none', lineHeight: 1.6, resize: 'none'
              }}
              spellCheck={false}
              placeholder="<html>...</html>"
            />
          </div>

          {/* Preview Panel */}
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="rn-preview-tabs">
              <button type="button" className={`rn-preview-tab${editorTab === 'preview' ? ' active' : ''}`} onClick={() => setEditorTab('preview')}>
                <Monitor size={14} style={{ display: 'inline', marginRight: 6 }} />Desktop
              </button>
              <button type="button" className={`rn-preview-tab${editorTab === 'mobile' ? ' active' : ''}`} onClick={() => setEditorTab('mobile')}>
                <Smartphone size={14} style={{ display: 'inline', marginRight: 6 }} />Mobile
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: editorTab === 'mobile' ? '20px' : 0, background: editorTab === 'preview' ? '#F8FAFC' : '#E5E7EB', display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: editorTab === 'mobile' ? '375px' : '100%', maxWidth: '100%', boxShadow: editorTab === 'mobile' ? '0 8px 32px rgba(0,0,0,0.2)' : 'none', borderRadius: editorTab === 'mobile' ? 16 : 0, overflow: 'hidden' }}>
                <iframe
                  srcDoc={`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:${editorTab === 'preview' ? '20px' : '0'};background:${editorTab === 'preview' ? '#F8FAFC' : '#fff'};}</style></head><body>${getPreviewHtml()}</body></html>`}
                  style={{ width: '100%', minHeight: 500, border: 'none', display: 'block' }}
                  title="Email Preview"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button type="button" onClick={() => setEditing(null)} style={{ padding: '12px 24px', background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 12, fontWeight: 600, cursor: 'pointer' }}>
            Discard
          </button>
          <form onSubmit={handleSave} style={{ display: 'contents' }}>
            <button type="submit" disabled={saving} style={{ padding: '12px 32px', background: 'linear-gradient(90deg, #10B981, #059669)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 16px -4px rgba(16, 185, 129, 0.4)', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving...' : '✓ Commit Template'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ animation: 'fadeIn 0.5s ease' }}>
      {/* Action Bar */}
      <div className="rn-action-bar">
        <input
          type="search"
          placeholder="Search email templates..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input"
          style={{ padding: '11px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-1)', width: '100%', maxWidth: 380, fontSize: 14 }}
        />
        <div className="rn-action-bar-buttons">
          {isSuperAdmin && (
            <button onClick={handleSeedDefaults} disabled={seeding} style={{ background: seeding ? '#94A3B8' : 'linear-gradient(90deg, #F59E0B, #EF4444)', color: '#fff', border: 'none', padding: '11px 20px', borderRadius: 10, cursor: seeding ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              {seeding ? '⏳ Seeding...' : '🔥 Seed Defaults'}
            </button>
          )}
          <button onClick={() => openEditor()} style={{ background: 'linear-gradient(90deg, #10B981, #059669)', color: '#fff', border: 'none', padding: '11px 22px', borderRadius: 10, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 6px 16px -4px rgba(16,185,129,0.4)' }}>
            <Plus size={16} /> New Template
          </button>
        </div>
      </div>

      {/* Card Grid */}
      <div className="rn-card-grid">
        {filteredTemplates.map(t => (
          <div key={t.id} style={{
            background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 20,
            overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
            display: 'flex', flexDirection: 'column', transition: 'box-shadow 0.2s'
          }}>
            <div style={{ height: 4, background: 'linear-gradient(90deg, #10B981, #3B82F6)' }} />
            <div style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,0.1)', padding: '4px 10px', borderRadius: 99, marginBottom: 12 }}>
                  <Zap size={11} fill="#10B981" /> {t.triggerEvent}
                </div>
                <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                  {t.subject}
                </h3>
              </div>
              <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: 14, flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Code size={11} /> VARIABLES
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Array.isArray(t.availableVariables) && t.availableVariables.length > 0
                    ? t.availableVariables.map((v: string) => (
                        <span key={v} style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontFamily: 'monospace' }}>
                          {`{{${v}}}`}
                        </span>
                      ))
                    : <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>No variables</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => openEditor(t)} style={{ flex: 1, padding: '10px', background: 'var(--surface-2)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Settings size={14} /> Edit
                </button>
                <button onClick={() => openEditor(t)} style={{ flex: 1, padding: '10px', background: 'var(--surface-2)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Eye size={14} /> Preview
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredTemplates.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 80, background: 'var(--surface-1)', borderRadius: 24, border: '2px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ background: 'var(--surface-2)', padding: 20, borderRadius: '50%', color: 'var(--text-tertiary)', marginBottom: 20 }}>
              <Mail size={36} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 20, color: 'var(--text-primary)', fontWeight: 700 }}>No email templates</h3>
            <p style={{ margin: '0 0 24px', color: 'var(--text-secondary)', fontSize: 15 }}>Seed the defaults or create a custom template.</p>
            {isSuperAdmin && (
              <button onClick={handleSeedDefaults} disabled={seeding} style={{ background: 'linear-gradient(90deg, #10B981, #059669)', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                {seeding ? '⏳ Seeding...' : '🔥 Seed Default Templates'}
              </button>
            )}
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }` }} />
    </div>
  );
}
