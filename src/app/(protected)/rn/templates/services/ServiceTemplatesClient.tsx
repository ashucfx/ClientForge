'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Briefcase, Plus, X, Box, CheckCircle2, ChevronRight, Coins, Settings, FolderOpen } from 'lucide-react';

type ServiceTemplate = any;

export default function ServiceTemplatesClient({ initialTemplates, isSuperAdmin }: { initialTemplates: ServiceTemplate[], isSuperAdmin?: boolean }) {
  const router = useRouter();
  const [templates, setTemplates] = useState<ServiceTemplate[]>(initialTemplates);
  const [seeding, setSeeding] = useState(false);

  const handleSeedProduction = async () => {
    if (!confirm('This will WIPE all existing blueprints and re-seed 112 fresh templates. Continue?')) return;
    setSeeding(true);
    try {
      const res = await fetch('/api/rn/admin/seed-templates', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ Successfully seeded ${data.seeded} blueprints!`);
        router.refresh();
      } else {
        alert('❌ Seed failed: ' + data.error);
      }
    } catch (e) {
      alert('❌ Network error during seed');
    } finally {
      setSeeding(false);
    }
  };
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
  const [search, setSearch] = useState('');

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

  const filteredTemplates = templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ animation: 'fadeIn 0.5s ease', marginTop: 24 }}>
      
      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, gap: 16, flexWrap: 'wrap' }}>
        <input 
          type="search" 
          placeholder="Search blueprints..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input"
          style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-1)', width: '100%', maxWidth: 400, fontSize: 14 }}
        />
        <div style={{ display: 'flex', gap: 12 }}>
        {isSuperAdmin && (
          <button 
            onClick={handleSeedProduction}
            disabled={seeding}
            style={{ 
              background: seeding ? '#94A3B8' : 'linear-gradient(90deg, #F59E0B, #EF4444)', 
              color: '#fff', border: 'none', padding: '12px 20px', borderRadius: 12, cursor: seeding ? 'not-allowed' : 'pointer', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 13
            }}
          >
            {seeding ? '⏳ Seeding...' : '🔥 Seed Production DB'}
          </button>
        )}
        <button 
          onClick={() => setIsCreating(true)}
          style={{ 
            background: 'linear-gradient(90deg, #3B82F6, #8B5CF6)', 
            color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 12, cursor: 'pointer', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 16px -4px rgba(59, 130, 246, 0.4)', transition: 'all 0.2s'
          }}
          onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
          onMouseOut={e => e.currentTarget.style.transform = 'none'}
        >
          <Plus size={18} /> New Blueprint
        </button>
        </div>
      </div>

      {/* Creation Modal */}
      {isCreating && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }}>
          <form onSubmit={handleCreate} style={{ background: 'var(--surface-1)', padding: 0, borderRadius: 24, border: '1px solid var(--border)', width: '100%', maxWidth: 600, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: 10, borderRadius: 12, color: '#3B82F6' }}><Box size={20} /></div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Create Service Blueprint</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>Define a reusable project template.</p>
                </div>
              </div>
              <button type="button" onClick={() => setIsCreating(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 8, borderRadius: 8 }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ padding: 32, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Blueprint Name</label>
                <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 14 }} placeholder="e.g. Enterprise SEO Audit" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Category</label>
                <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 14 }}>
                  <option>Software Development</option>
                  <option>AI Services</option>
                  <option>Marketing</option>
                  <option>UI/UX Design</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Pricing Model</label>
                <select value={formData.pricingModel} onChange={e => setFormData({...formData, pricingModel: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 14 }}>
                  <option>FIXED</option>
                  <option>HOURLY</option>
                  <option>MONTHLY</option>
                  <option>MILESTONE</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Base Currency</label>
                <select value={formData.baseCurrency} onChange={e => setFormData({...formData, baseCurrency: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 14 }}>
                  <option>USD</option>
                  <option>INR</option>
                  <option>EUR</option>
                  <option>GBP</option>
                </select>
              </div>
            </div>

            <div style={{ padding: '24px 32px', borderTop: '1px solid var(--border)', display: 'flex', gap: 12, justifyContent: 'flex-end', background: 'var(--surface-2)' }}>
              <button type="button" onClick={() => setIsCreating(false)} style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)', border: 'none', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button type="submit" style={{ background: 'linear-gradient(90deg, #3B82F6, #8B5CF6)', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}>Provision Blueprint</button>
            </div>
          </form>
        </div>
      )}

      {/* Advanced Configuration JSON Modal */}
      {editingMeta && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ background: '#1E1E1E', padding: 0, borderRadius: 24, width: '100%', maxWidth: 800, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #333', background: '#252526', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Settings size={18} color="#4EC9B0" />
                <h3 style={{ margin: 0, color: '#D4D4D4', fontSize: 15, fontWeight: 500 }}>Advanced Config: <span style={{ color: '#9CDCFE' }}>{editingMeta.name}</span></h3>
              </div>
              <button onClick={() => setEditingMeta(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#858585' }}><X size={18} /></button>
            </div>
            
            <div style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <p style={{ fontSize: 13, color: '#858585', margin: '0 0 16px 0' }}>Define deliverables, dependencies, and automation rules in JSON format.</p>
              <textarea
                value={metaJson}
                onChange={e => setMetaJson(e.target.value)}
                style={{ 
                  flex: 1, minHeight: 400, fontFamily: '"Fira Code", monospace', fontSize: 14, 
                  padding: 16, background: '#1E1E1E', color: '#CE9178', border: '1px solid #333', 
                  borderRadius: 8, outline: 'none', lineHeight: 1.5, resize: 'none'
                }}
                spellCheck="false"
              />
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #333', display: 'flex', gap: 12, justifyContent: 'flex-end', background: '#252526' }}>
              <button onClick={() => setEditingMeta(null)} style={{ background: '#333', color: '#D4D4D4', border: 'none', padding: '8px 20px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Discard</button>
              <button onClick={saveMeta} disabled={savingMeta} style={{ background: '#0E639C', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                {savingMeta ? 'Saving...' : 'Commit Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 24 }}>
        {filteredTemplates.map(t => (
          <div key={t.id} style={{ 
            background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 20, 
            padding: 24, boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden',
            display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #3B82F6, #8B5CF6)' }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, marginTop: 4 }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#3B82F6', background: 'rgba(59,130,246,0.1)', padding: '4px 10px', borderRadius: 99, marginBottom: 12 }}>
                  <FolderOpen size={12} /> {t.category}
                </div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{t.name}</h3>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>v{t.version}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, background: 'var(--surface-2)', padding: '12px 16px', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Briefcase size={14} color="#8B5CF6"/> {t.pricingModel}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Coins size={14} color="#10B981"/> {t.baseCurrency}</div>
            </div>

            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={14} color="#3B82F6"/> {t.milestoneTemplates?.length || 0} Milestones
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Box size={14} color="#F59E0B"/> {t.deliverableTemplates?.length || 0} Deliverables
              </div>
            </div>

            <div style={{ marginTop: 'auto', display: 'flex', gap: 12 }}>
               <button onClick={() => openMetaEditor(t)} style={{ flex: 1, padding: '10px', background: 'var(--surface-2)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.2s' }} onMouseOver={e=>e.currentTarget.style.background='var(--surface-3)'} onMouseOut={e=>e.currentTarget.style.background='var(--surface-2)'}>
                 <Settings size={14} /> Config
               </button>
               <button style={{ flex: 1, padding: '10px', background: 'var(--surface-2)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.2s' }} onMouseOver={e=>e.currentTarget.style.background='var(--surface-3)'} onMouseOut={e=>e.currentTarget.style.background='var(--surface-2)'}>
                 Milestones <ChevronRight size={14} />
               </button>
            </div>
          </div>
        ))}

        {filteredTemplates.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 80, background: 'var(--surface-1)', borderRadius: 24, border: '2px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ background: 'var(--surface-2)', padding: 16, borderRadius: '50%', color: 'var(--text-tertiary)', marginBottom: 16 }}>
              <Box size={32} />
            </div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 18, color: 'var(--text-primary)' }}>No templates found</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>Create a new service blueprint to get started.</p>
          </div>
        )}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
