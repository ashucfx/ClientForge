'use client';

import { useState, useEffect, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import AppShell from '@/components/AppShell';
import { useBrand } from '@/components/BrandProvider';
import { getBrand } from '@/lib/brand/registry';
import {
  IconUser, IconTarget, IconSearch, IconFilter, IconRefresh,
  IconChevronRight, IconMail, IconTrendUp, IconX
} from '@/components/Icons';

const STAGES = ['SUBSCRIBER', 'LEAD', 'MQL', 'SQL', 'CUSTOMER', 'CHURNED'] as const;
const STAGE_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  SUBSCRIBER: { label: 'Subscribers', color: '#64748b', bg: '#f1f5f9', border: '#e2e8f0' },
  LEAD:       { label: 'Leads',       color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  MQL:        { label: 'MQL',         color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe' },
  SQL:        { label: 'SQL',         color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
  CUSTOMER:   { label: 'Customers',   color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' },
  CHURNED:    { label: 'Churned',     color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
};

interface PipelineContact {
  id: string;
  displayId: string;
  name: string;
  email: string;
  phone: string;
  companyName: string;
  industry: string;
  jobTitle: string;
  contactSource: string;
  createdAt: string;
  lifecycleStage: string;
  leadStatus: string;
  engagementScore: number;
  totalRevenue: number;
  lastContactedAt: string | null;
  lastInvoiceDate: string | null;
  invoiceCount: number;
  linkedClients: number;
}

export default function FlywheelPipeline() {
  const { activeBrand } = useBrand();
  const brand = getBrand(activeBrand === 'all' ? 'catalyst' : activeBrand);

  const [pipeline, setPipeline] = useState<Record<string, PipelineContact[]>>({});
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<PipelineContact | null>(null);
  const [saving, setSaving] = useState(false);
  const [editStage, setEditStage] = useState('');
  const [editStatus, setEditStatus] = useState('');

  const fetchPipeline = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/flywheel/pipeline?${params}`);
      if (res.ok) {
        const json = await res.json();
        setPipeline(json.data.pipeline);
        setStageCounts(json.data.stageCounts);
      }
    } catch (e) {
      console.error('Failed to fetch pipeline', e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchPipeline(); }, [fetchPipeline]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPipeline();
  };

  const openContact = (contact: PipelineContact) => {
    setSelectedContact(contact);
    setEditStage(contact.lifecycleStage);
    setEditStatus(contact.leadStatus);
  };

  const handleStageChange = async () => {
    if (!selectedContact) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/flywheel/leads/${selectedContact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lifecycleStage: editStage, leadStatus: editStatus })
      });
      setSelectedContact(null);
      fetchPipeline();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const totalInPipeline = Object.values(stageCounts).reduce((s, n) => s + n, 0);

  return (
    <AppShell>
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}>
                <IconTarget size={20} style={{ color: '#fff' }} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Pipeline & CRM</h1>
            </div>
            <p className="text-slate-500 mt-1 ml-[52px]">{totalInPipeline} contacts across {Object.keys(stageCounts).filter(k => (stageCounts[k] || 0) > 0).length} stages</p>
          </div>

          <form onSubmit={handleSearch} className="flex items-center gap-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><IconSearch size={15} /></span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search contacts..."
                className="pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm w-64 focus:ring-2 focus:border-transparent outline-none"
                style={{ '--tw-ring-color': brand.primaryColor } as any}
              />
            </div>
            <button type="submit" className="px-4 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-600 font-medium text-sm shadow-sm hover:bg-slate-50 transition-colors">
              <IconFilter size={15} />
            </button>
            <button type="button" onClick={fetchPipeline} className="px-4 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-600 font-medium text-sm shadow-sm hover:bg-slate-50 transition-colors">
              <IconRefresh size={15} />
            </button>
          </form>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-32">
            <div className="animate-spin text-violet-600"><IconRefresh size={32} /></div>
          </div>
        ) : (
          /* Pipeline Board */
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2" style={{ minHeight: '65vh' }}>
            {STAGES.map(stage => {
              const meta = STAGE_META[stage];
              const contacts = pipeline[stage] || [];
              return (
                <div key={stage} className="flex-shrink-0 w-72 flex flex-col">
                  {/* Column Header */}
                  <div className="rounded-t-xl px-4 py-3 flex items-center justify-between" style={{ background: meta.bg, borderBottom: `2px solid ${meta.border}` }}>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: meta.color }} />
                      <span className="font-semibold text-sm" style={{ color: meta.color }}>{meta.label}</span>
                    </div>
                    <span className="text-xs font-bold rounded-full px-2 py-0.5" style={{ background: meta.border, color: meta.color }}>
                      {contacts.length}
                    </span>
                  </div>

                  {/* Cards Container */}
                  <div className="flex-1 rounded-b-xl bg-slate-50/50 p-2 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
                    {contacts.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-xs">No contacts in this stage</div>
                    ) : (
                      contacts.map(contact => (
                        <button
                          key={contact.id}
                          onClick={() => openContact(contact)}
                          className="w-full text-left bg-white rounded-xl p-3.5 shadow-sm border border-slate-100 hover:shadow-md hover:border-slate-200 transition-all group"
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0" style={{ background: meta.color }}>
                              {contact.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-slate-800 text-sm truncate">{contact.name}</div>
                              <div className="text-xs text-slate-400 truncate">{contact.jobTitle || contact.email || 'No info'}</div>
                            </div>
                            <IconChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 mt-1 flex-shrink-0 transition-colors" />
                          </div>

                          {/* Mini metrics */}
                          <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-slate-50">
                            {contact.engagementScore > 0 && (
                              <div className="flex items-center gap-1 text-xs">
                                <span className="text-amber-500">⚡</span>
                                <span className="font-medium text-slate-500">{contact.engagementScore}</span>
                              </div>
                            )}
                            {contact.totalRevenue > 0 && (
                              <div className="flex items-center gap-1 text-xs">
                                <span className="text-emerald-500">₹</span>
                                <span className="font-medium text-slate-500">{contact.totalRevenue.toLocaleString()}</span>
                              </div>
                            )}
                            {contact.linkedClients > 0 && (
                              <div className="flex items-center gap-1 text-xs">
                                <IconUser size={11} style={{ color: '#94a3b8' }} />
                                <span className="font-medium text-slate-500">{contact.linkedClients}</span>
                              </div>
                            )}
                            {contact.companyName && (
                              <div className="text-xs text-slate-400 truncate ml-auto">{contact.companyName}</div>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Contact Detail Slide-Over */}
      <Dialog.Root open={!!selectedContact} onOpenChange={open => !open && setSelectedContact(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity" />
          <Dialog.Content className="fixed top-0 right-0 h-full w-[90vw] max-w-md bg-white shadow-2xl z-50 animate-in slide-in-from-right duration-300 flex flex-col">
            {selectedContact && (
              <>
                {/* Header */}
                <div className="p-6 border-b border-slate-100" style={{ background: STAGE_META[selectedContact.lifecycleStage]?.bg || '#f1f5f9' }}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: STAGE_META[selectedContact.lifecycleStage]?.color || '#64748b' }}>
                        {selectedContact.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <Dialog.Title className="text-lg font-bold text-slate-900">{selectedContact.name}</Dialog.Title>
                        <Dialog.Description className="text-sm text-slate-500">{selectedContact.jobTitle || selectedContact.email || 'Contact'}</Dialog.Description>
                      </div>
                    </div>
                    <Dialog.Close asChild>
                      <button className="p-2 rounded-lg hover:bg-white/50 transition-colors"><IconX size={18} className="text-slate-400" /></button>
                    </Dialog.Close>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold" style={{
                      background: STAGE_META[selectedContact.lifecycleStage]?.border,
                      color: STAGE_META[selectedContact.lifecycleStage]?.color
                    }}>
                      {STAGE_META[selectedContact.lifecycleStage]?.label || selectedContact.lifecycleStage}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                      {selectedContact.leadStatus}
                    </span>
                    {selectedContact.displayId && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-white text-slate-500 border border-slate-200">
                        {selectedContact.displayId}
                      </span>
                    )}
                  </div>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">

                  {/* Contact Info */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Contact Information</h4>
                    <div className="space-y-2">
                      {selectedContact.email && (
                        <div className="flex items-center gap-3 text-sm">
                          <IconMail size={14} className="text-slate-400" />
                          <span className="text-slate-700">{selectedContact.email}</span>
                        </div>
                      )}
                      {selectedContact.phone && (
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-slate-400 text-xs w-[14px] text-center">📱</span>
                          <span className="text-slate-700">{selectedContact.phone}</span>
                        </div>
                      )}
                      {selectedContact.companyName && (
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-slate-400 text-xs w-[14px] text-center">🏢</span>
                          <span className="text-slate-700">{selectedContact.companyName}</span>
                        </div>
                      )}
                      {selectedContact.industry && (
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-slate-400 text-xs w-[14px] text-center">🏭</span>
                          <span className="text-slate-700">{selectedContact.industry}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Metrics */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Engagement Metrics</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-slate-50 rounded-lg p-3 text-center">
                        <div className="text-xl font-bold text-slate-800">{selectedContact.engagementScore}</div>
                        <div className="text-xs text-slate-500 mt-0.5">Eng. Score</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 text-center">
                        <div className="text-xl font-bold text-emerald-600">₹{selectedContact.totalRevenue.toLocaleString()}</div>
                        <div className="text-xs text-slate-500 mt-0.5">Revenue</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 text-center">
                        <div className="text-xl font-bold text-slate-800">{selectedContact.invoiceCount}</div>
                        <div className="text-xs text-slate-500 mt-0.5">Invoices</div>
                      </div>
                    </div>
                  </div>

                  {/* Stage Change */}
                  <div className="border-t border-slate-100 pt-5">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Move in Pipeline</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">Lifecycle Stage</label>
                        <select
                          value={editStage}
                          onChange={e => setEditStage(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm"
                        >
                          {STAGES.map(s => (
                            <option key={s} value={s}>{STAGE_META[s]?.label || s}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">Lead Status</label>
                        <select
                          value={editStatus}
                          onChange={e => setEditStatus(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm"
                        >
                          <option value="NEW">New</option>
                          <option value="OPEN">Open</option>
                          <option value="CONTACTED">Contacted</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="QUALIFIED">Qualified</option>
                          <option value="UNQUALIFIED">Unqualified</option>
                          <option value="REACTIVATION_TARGET">Reactivation Target</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Timeline placeholder */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Activity</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 text-sm text-slate-500">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Created {new Date(selectedContact.createdAt).toLocaleDateString()}
                      </div>
                      {selectedContact.lastContactedAt && (
                        <div className="flex items-center gap-3 text-sm text-slate-500">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                          Last contacted {new Date(selectedContact.lastContactedAt).toLocaleDateString()}
                        </div>
                      )}
                      {selectedContact.lastInvoiceDate && (
                        <div className="flex items-center gap-3 text-sm text-slate-500">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          Last invoice {new Date(selectedContact.lastInvoiceDate).toLocaleDateString()}
                        </div>
                      )}
                      {selectedContact.linkedClients > 0 && (
                        <div className="flex items-center gap-3 text-sm text-slate-500">
                          <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                          {selectedContact.linkedClients} linked project{selectedContact.linkedClients > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                  <Dialog.Close asChild>
                    <button className="px-4 py-2 text-slate-500 font-medium hover:bg-slate-100 rounded-lg text-sm transition-colors">Cancel</button>
                  </Dialog.Close>
                  <button
                    onClick={handleStageChange}
                    disabled={saving || (editStage === selectedContact.lifecycleStage && editStatus === selectedContact.leadStatus)}
                    className="px-5 py-2 text-white font-medium rounded-lg shadow-sm text-sm disabled:opacity-50 transition-all hover:shadow-md"
                    style={{ background: brand.primaryColor }}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </AppShell>
  );
}
