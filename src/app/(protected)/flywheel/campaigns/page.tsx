'use client';

import { useState, useEffect, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import AppShell from '@/components/AppShell';
import { useBrand } from '@/components/BrandProvider';
import { getBrand } from '@/lib/brand/registry';
import {
  IconMail, IconSend, IconPlus, IconEye, IconX, IconRefresh,
  IconPlay, IconPause, IconUser, IconChevronRight, IconTrendUp, IconSearch
} from '@/components/Icons';

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  DRAFT:     { label: 'Draft',     bg: '#f1f5f9', color: '#64748b' },
  ACTIVE:    { label: 'Active',    bg: '#ecfdf5', color: '#10b981' },
  PAUSED:    { label: 'Paused',    bg: '#fffbeb', color: '#f59e0b' },
  COMPLETED: { label: 'Completed', bg: '#eff6ff', color: '#3b82f6' },
};

interface Campaign {
  id: string; name: string; type: string; status: string; createdAt: string;
  _count: { leads: number; steps: number };
  stats?: { sent: number; opens: number; unsubs: number; openRate: number };
}

// ──── Content Block Types ────
type BlockType = 'heading' | 'paragraph' | 'button' | 'divider';
interface ContentBlock { id: string; type: BlockType; content: string; extra?: string; }

export default function FlywheelCampaigns() {
  const { activeBrand } = useBrand();
  const brand = getBrand(activeBrand === 'all' ? 'catalyst' : activeBrand);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  // Create wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [campaignName, setCampaignName] = useState('');
  const [campaignType, setCampaignType] = useState('ONE_OFF');
  const [subject, setSubject] = useState('');
  const [blocks, setBlocks] = useState<ContentBlock[]>([
    { id: '1', type: 'heading', content: 'Hello from {brand}' },
    { id: '2', type: 'paragraph', content: 'Write your message here...' },
  ]);
  const [audienceFilter, setAudienceFilter] = useState('ALL');
  const [audienceCount, setAudienceCount] = useState(0);
  const [saving, setSaving] = useState(false);

  // Detail / dispatch
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/flywheel/campaigns');
      if (res.ok) {
        const json = await res.json();
        setCampaigns(json.campaigns || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  // Audience count estimation
  useEffect(() => {
    if (!wizardOpen) return;
    const estimateAudience = async () => {
      try {
        const params = new URLSearchParams();
        if (audienceFilter !== 'ALL') params.set('stage', audienceFilter);
        const res = await fetch(`/api/admin/flywheel/leads?${params}&pageSize=1`);
        if (res.ok) {
          const data = await res.json();
          setAudienceCount(data.pagination?.total || 0);
        }
      } catch { /* silent */ }
    };
    estimateAudience();
  }, [audienceFilter, wizardOpen]);

  // ── Block editor helpers ──
  const addBlock = (type: BlockType) => {
    const defaults: Record<BlockType, string> = { heading: 'Section Title', paragraph: 'Your content here...', button: 'Click Here', divider: '' };
    setBlocks([...blocks, { id: Date.now().toString(), type, content: defaults[type] }]);
  };
  const updateBlock = (id: string, field: string, value: string) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, [field]: value } : b));
  };
  const removeBlock = (id: string) => setBlocks(blocks.filter(b => b.id !== id));
  const moveBlock = (idx: number, dir: number) => {
    const next = [...blocks];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setBlocks(next);
  };

  // Build HTML from blocks
  const blocksToHtml = () => {
    return blocks.map(b => {
      switch (b.type) {
        case 'heading': return `<h2 style="font-size:20px;font-weight:700;color:#1e293b;margin:24px 0 8px;">${b.content}</h2>`;
        case 'paragraph': return `<p style="font-size:15px;line-height:1.7;color:#475569;margin:12px 0;">${b.content}</p>`;
        case 'button': return `<p style="text-align:center;margin:24px 0;"><a href="${b.extra || '#'}" style="display:inline-block;padding:12px 28px;background:${brand.primaryColor};color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">${b.content}</a></p>`;
        case 'divider': return `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />`;
        default: return '';
      }
    }).join('\n');
  };

  // Create campaign
  const handleCreate = async () => {
    if (!campaignName || !subject) return;
    setSaving(true);
    try {
      const body: any = { name: campaignName, type: campaignType, subject, htmlBody: blocksToHtml(), brandId: activeBrand };
      if (audienceFilter !== 'ALL') body.filters = { lifecycleStage: audienceFilter };
      const res = await fetch('/api/admin/flywheel/campaigns', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      if (res.ok) {
        setWizardOpen(false);
        resetWizard();
        fetchCampaigns();
      }
    } finally { setSaving(false); }
  };

  const resetWizard = () => {
    setWizardStep(1); setCampaignName(''); setCampaignType('ONE_OFF');
    setSubject(''); setAudienceFilter('ALL');
    setBlocks([
      { id: '1', type: 'heading', content: 'Hello from {brand}' },
      { id: '2', type: 'paragraph', content: 'Write your message here...' },
    ]);
  };

  // Dispatch campaign
  const handleDispatch = async (campaignId: string) => {
    setDispatching(true); setDispatchResult(null);
    try {
      const res = await fetch(`/api/admin/flywheel/campaigns/${campaignId}/dispatch`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setDispatchResult(`Campaign dispatched to ${data.leadsQueued || 0} contacts.`);
        fetchCampaigns();
      } else { setDispatchResult(`Error: ${data.error || 'Failed to dispatch'}`); }
    } catch { setDispatchResult('An error occurred.'); }
    finally { setDispatching(false); }
  };

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                <IconMail size={20} style={{ color: '#fff' }} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Campaigns</h1>
            </div>
            <p className="text-slate-500 mt-1 ml-[52px]">Create, manage, and track email marketing campaigns.</p>
          </div>
          <button onClick={() => { setWizardOpen(true); resetWizard(); }} className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-medium text-sm shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5" style={{ background: brand.gradient }}>
            <IconPlus size={16} /> New Campaign
          </button>
        </div>

        {/* Campaign Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Campaign Name</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-center">Audience</th>
                  <th className="px-5 py-3.5 text-center">Sent</th>
                  <th className="px-5 py-3.5 text-center">Opens</th>
                  <th className="px-5 py-3.5 text-center">Open Rate</th>
                  <th className="px-5 py-3.5 text-center">Created</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={9} className="px-5 py-4"><div className="skeleton h-4 rounded" style={{ width: `${50 + Math.random() * 40}%` }} /></td></tr>
                  ))
                ) : campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-16 text-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-300 mb-4 border border-emerald-100"><IconMail size={28} /></div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">No campaigns yet</h3>
                      <p className="text-slate-500 text-sm mb-4">Create your first campaign to start engaging your audience.</p>
                      <button onClick={() => { setWizardOpen(true); resetWizard(); }} className="px-4 py-2 text-white rounded-lg text-sm font-medium" style={{ background: brand.primaryColor }}>
                        <IconPlus size={14} className="inline mr-1" /> Create Campaign
                      </button>
                    </td>
                  </tr>
                ) : campaigns.map(c => {
                  const meta = STATUS_META[c.status] || STATUS_META.DRAFT;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors cursor-pointer group" onClick={() => setSelectedCampaign(c)}>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">{c.name}</div>
                      </td>
                      <td className="px-5 py-4"><span className="text-xs font-medium text-slate-500">{c.type.replace('_', ' ')}</span></td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                      </td>
                      <td className="px-5 py-4 text-center font-semibold text-slate-700">{c._count?.leads || 0}</td>
                      <td className="px-5 py-4 text-center font-semibold text-blue-600">{c.stats?.sent || 0}</td>
                      <td className="px-5 py-4 text-center font-semibold text-violet-600">{c.stats?.opens || 0}</td>
                      <td className="px-5 py-4 text-center font-semibold text-amber-600">{c.stats?.openRate || 0}%</td>
                      <td className="px-5 py-4 text-center text-xs text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {c.status === 'DRAFT' && (
                            <button onClick={() => handleDispatch(c.id)} disabled={dispatching} className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md text-xs font-semibold hover:bg-emerald-100 transition-colors flex items-center gap-1">
                              <IconSend size={12} /> Launch
                            </button>
                          )}
                          <button onClick={() => setSelectedCampaign(c)} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-md text-xs font-medium hover:text-blue-600 transition-colors flex items-center gap-1">
                            <IconEye size={12} /> Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── CAMPAIGN WIZARD (Multi-step) ── */}
      <Dialog.Root open={wizardOpen} onOpenChange={setWizardOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl w-[95vw] max-w-2xl z-50 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">

            {/* Wizard Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <Dialog.Title className="text-lg font-bold text-slate-900">New Campaign</Dialog.Title>
                <Dialog.Description className="text-sm text-slate-500">Step {wizardStep} of 4</Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button className="p-2 rounded-lg hover:bg-slate-100"><IconX size={18} className="text-slate-400" /></button>
              </Dialog.Close>
            </div>

            {/* Progress Bar */}
            <div className="h-1 bg-slate-100">
              <div className="h-full transition-all duration-300" style={{ width: `${(wizardStep / 4) * 100}%`, background: brand.gradient }} />
            </div>

            {/* Wizard Body */}
            <div className="p-6 overflow-y-auto flex-1">

              {/* Step 1: Setup */}
              {wizardStep === 1 && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Campaign Name</label>
                    <input value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="e.g., Welcome Series, Summer Offer..." className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:bg-white outline-none" style={{ '--tw-ring-color': brand.primaryColor } as any} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Campaign Type</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: 'ONE_OFF', label: 'One-Off Blast', desc: 'Send once to all selected contacts' },
                        { value: 'DRIP', label: 'Drip Sequence', desc: 'Send steps over time (planned)' },
                      ].map(opt => (
                        <button key={opt.value} type="button" onClick={() => setCampaignType(opt.value)} className={`p-4 rounded-xl border-2 text-left transition-all ${campaignType === opt.value ? 'bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`} style={campaignType === opt.value ? { borderColor: brand.primaryColor } : {}}>
                          <div className="font-semibold text-slate-800 text-sm">{opt.label}</div>
                          <div className="text-xs text-slate-500 mt-1">{opt.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Audience */}
              {wizardStep === 2 && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Select Audience</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: 'ALL', label: 'All Contacts', desc: 'Everyone in your registry' },
                        { value: 'SUBSCRIBER', label: 'Subscribers', desc: 'Early-stage contacts' },
                        { value: 'LEAD', label: 'Leads', desc: 'Active leads in pipeline' },
                        { value: 'MQL', label: 'MQL', desc: 'Marketing qualified leads' },
                        { value: 'SQL', label: 'SQL', desc: 'Sales qualified leads' },
                        { value: 'CUSTOMER', label: 'Customers', desc: 'Converted customers' },
                      ].map(opt => (
                        <button key={opt.value} type="button" onClick={() => setAudienceFilter(opt.value)} className={`p-4 rounded-xl border-2 text-left transition-all ${audienceFilter === opt.value ? 'bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`} style={audienceFilter === opt.value ? { borderColor: brand.primaryColor } : {}}>
                          <div className="font-semibold text-slate-800 text-sm">{opt.label}</div>
                          <div className="text-xs text-slate-500 mt-1">{opt.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-xl flex items-center gap-3">
                    <IconUser size={18} style={{ color: brand.primaryColor }} />
                    <span className="text-sm font-semibold text-slate-700">Estimated audience: <span style={{ color: brand.primaryColor }}>{audienceCount.toLocaleString()}</span> contacts</span>
                  </div>
                </div>
              )}

              {/* Step 3: Content */}
              {wizardStep === 3 && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Email Subject Line</label>
                    <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g., We have something special for you!" className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:bg-white outline-none" style={{ '--tw-ring-color': brand.primaryColor } as any} />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">Email Content</label>

                    {/* Block Editor */}
                    <div className="space-y-3 mb-4">
                      {blocks.map((block, idx) => (
                        <div key={block.id} className="flex gap-2 items-start group">
                          <div className="flex flex-col gap-0.5 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {idx > 0 && <button type="button" onClick={() => moveBlock(idx, -1)} className="text-[10px] text-slate-400 hover:text-slate-600">▲</button>}
                            {idx < blocks.length - 1 && <button type="button" onClick={() => moveBlock(idx, 1)} className="text-[10px] text-slate-400 hover:text-slate-600">▼</button>}
                          </div>
                          <div className="flex-1">
                            {block.type === 'heading' && (
                              <input value={block.content} onChange={e => updateBlock(block.id, 'content', e.target.value)} className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-sm font-bold outline-none focus:ring-1" placeholder="Heading text" />
                            )}
                            {block.type === 'paragraph' && (
                              <textarea value={block.content} onChange={e => updateBlock(block.id, 'content', e.target.value)} rows={3} className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-sm outline-none focus:ring-1 resize-none" placeholder="Write your paragraph..." />
                            )}
                            {block.type === 'button' && (
                              <div className="flex gap-2">
                                <input value={block.content} onChange={e => updateBlock(block.id, 'content', e.target.value)} className="flex-1 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-sm outline-none font-semibold" placeholder="Button text" />
                                <input value={block.extra || ''} onChange={e => updateBlock(block.id, 'extra', e.target.value)} className="flex-1 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-sm outline-none" placeholder="https://..." />
                              </div>
                            )}
                            {block.type === 'divider' && (
                              <div className="border-t border-slate-300 my-2" />
                            )}
                          </div>
                          <button type="button" onClick={() => removeBlock(block.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                            <IconX size={14} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add Block Buttons */}
                    <div className="flex gap-2 flex-wrap">
                      {([['heading', 'H', '+ Heading'], ['paragraph', '¶', '+ Text'], ['button', '◉', '+ Button'], ['divider', '—', '+ Divider']] as const).map(([type, icon, label]) => (
                        <button key={type} type="button" onClick={() => addBlock(type)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5">
                          <span className="font-mono">{icon}</span> {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Review */}
              {wizardStep === 4 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: brand.primaryLight }}>
                      <IconSend size={24} style={{ color: brand.primaryColor }} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Ready to create?</h3>
                    <p className="text-slate-500 text-sm mt-1">Review your campaign details before creating.</p>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-5 space-y-4">
                    {[
                      ['Campaign Name', campaignName],
                      ['Type', campaignType === 'ONE_OFF' ? 'One-Off Blast' : 'Drip Sequence'],
                      ['Audience', audienceFilter === 'ALL' ? `All contacts (${audienceCount})` : `${audienceFilter} (${audienceCount})`],
                      ['Subject', subject],
                      ['Content Blocks', `${blocks.length} blocks`],
                    ].map(([label, value]) => (
                      <div key={label as string} className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">{label}</span>
                        <span className="text-sm font-semibold text-slate-800">{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Email Preview */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">Email Preview</h4>
                    <div className="border border-slate-200 rounded-xl p-6 bg-white max-h-72 overflow-y-auto">
                      <div dangerouslySetInnerHTML={{ __html: blocksToHtml() }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Wizard Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex justify-between">
              <button onClick={() => wizardStep > 1 ? setWizardStep(wizardStep - 1) : setWizardOpen(false)} className="px-4 py-2 text-slate-500 font-medium rounded-lg hover:bg-slate-50 text-sm transition-colors">
                {wizardStep > 1 ? '← Back' : 'Cancel'}
              </button>
              {wizardStep < 4 ? (
                <button onClick={() => setWizardStep(wizardStep + 1)} disabled={wizardStep === 1 && !campaignName} className="px-5 py-2 text-white font-medium rounded-lg text-sm disabled:opacity-50 transition-all" style={{ background: brand.primaryColor }}>
                  Next →
                </button>
              ) : (
                <button onClick={handleCreate} disabled={saving || !campaignName || !subject} className="px-5 py-2 text-white font-medium rounded-lg text-sm disabled:opacity-50 shadow-sm transition-all" style={{ background: brand.gradient }}>
                  {saving ? 'Creating...' : 'Create Campaign'}
                </button>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* ── CAMPAIGN DETAIL SLIDE-OVER ── */}
      <Dialog.Root open={!!selectedCampaign} onOpenChange={open => { if (!open) { setSelectedCampaign(null); setDispatchResult(null); } }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40" />
          <Dialog.Content className="fixed top-0 right-0 h-full w-[90vw] max-w-md bg-white shadow-2xl z-50 animate-in slide-in-from-right duration-300 flex flex-col">
            {selectedCampaign && (
              <>
                <div className="p-6 border-b border-slate-100" style={{ background: STATUS_META[selectedCampaign.status]?.bg || '#f1f5f9' }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <Dialog.Title className="text-lg font-bold text-slate-900">{selectedCampaign.name}</Dialog.Title>
                      <Dialog.Description className="text-sm text-slate-500 mt-0.5">
                        {selectedCampaign.type.replace('_', ' ')} · Created {new Date(selectedCampaign.createdAt).toLocaleDateString()}
                      </Dialog.Description>
                    </div>
                    <Dialog.Close asChild>
                      <button className="p-2 rounded-lg hover:bg-white/50"><IconX size={18} className="text-slate-400" /></button>
                    </Dialog.Close>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold mt-3" style={{
                    background: STATUS_META[selectedCampaign.status]?.color + '20',
                    color: STATUS_META[selectedCampaign.status]?.color
                  }}>
                    {STATUS_META[selectedCampaign.status]?.label}
                  </span>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-slate-800">{selectedCampaign._count?.leads || 0}</div>
                      <div className="text-xs text-slate-500 mt-1">Audience</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">{selectedCampaign.stats?.sent || 0}</div>
                      <div className="text-xs text-slate-500 mt-1">Sent</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-violet-600">{selectedCampaign.stats?.opens || 0}</div>
                      <div className="text-xs text-slate-500 mt-1">Opens</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-amber-600">{selectedCampaign.stats?.openRate || 0}%</div>
                      <div className="text-xs text-slate-500 mt-1">Open Rate</div>
                    </div>
                  </div>

                  {dispatchResult && (
                    <div className={`p-4 rounded-lg text-sm font-medium ${dispatchResult.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{dispatchResult}</div>
                  )}
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                  <Dialog.Close asChild>
                    <button className="px-4 py-2 text-slate-500 font-medium hover:bg-slate-100 rounded-lg text-sm">Close</button>
                  </Dialog.Close>
                  {selectedCampaign.status === 'DRAFT' && (
                    <button onClick={() => handleDispatch(selectedCampaign.id)} disabled={dispatching} className="px-5 py-2 text-white font-medium rounded-lg shadow-sm text-sm flex items-center gap-2" style={{ background: brand.primaryColor }}>
                      <IconSend size={14} /> {dispatching ? 'Dispatching...' : 'Launch Campaign'}
                    </button>
                  )}
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </AppShell>
  );
}
