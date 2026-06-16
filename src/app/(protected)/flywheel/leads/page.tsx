'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Papa from 'papaparse';
import * as Dialog from '@radix-ui/react-dialog';
import AppShell from '@/components/AppShell';
import { useBrand } from '@/components/BrandProvider';
import { getBrand } from '@/lib/brand/registry';
import {
  IconInbox, IconUser, IconPlus, IconTrendUp, IconSearch, IconFilter,
  IconRefresh, IconX, IconChevronRight, IconMail, IconEye, IconChevronDown
} from '@/components/Icons';

const STAGE_COLORS: Record<string, { bg: string; color: string }> = {
  SUBSCRIBER: { bg: '#f1f5f9', color: '#64748b' },
  LEAD:       { bg: '#eff6ff', color: '#3b82f6' },
  MQL:        { bg: '#f5f3ff', color: '#8b5cf6' },
  SQL:        { bg: '#fffbeb', color: '#f59e0b' },
  CUSTOMER:   { bg: '#ecfdf5', color: '#10b981' },
  CHURNED:    { bg: '#fef2f2', color: '#ef4444' },
};

interface Pagination { page: number; pageSize: number; total: number; totalPages: number; }

export default function FlywheelLeadsPage() {
  const { activeBrand } = useBrand();
  const brand = getBrand(activeBrand === 'all' ? 'catalyst' : activeBrand);

  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 25, total: 0, totalPages: 0 });

  // Filters
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  
  // Timeline State
  const [activeTab, setActiveTab] = useState<'profile' | 'timeline'>('profile');
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Forms
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchContacts = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', '25');
      if (search) params.set('search', search);
      if (stageFilter) params.set('stage', stageFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (sourceFilter) params.set('source', sourceFilter);

      const res = await fetch(`/api/admin/flywheel/leads?${params}`);
      if (res.ok) {
        const data = await res.json();
        setContacts(data.data || []);
        setPagination(data.pagination);
      }
    } catch (e) {
      console.error('Failed to fetch leads', e);
    } finally {
      setLoading(false);
    }
  }, [search, stageFilter, statusFilter, sourceFilter]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchContacts(1);
  };

  const clearFilters = () => {
    setSearch(''); setStageFilter(''); setStatusFilter(''); setSourceFilter('');
  };

  const hasActiveFilters = search || stageFilter || statusFilter || sourceFilter;

  // Create Lead
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/flywheel/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, brandId: activeBrand })
      });
      if (res.ok) {
        setIsCreateModalOpen(false);
        setFormData({});
        fetchContacts();
      } else { alert('Failed to create lead'); }
    } finally { setSaving(false); }
  };

  const deleteLead = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    try {
      const res = await fetch(`/api/admin/flywheel/leads/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setContacts(contacts.filter(c => c.id !== id));
      } else {
        alert('Failed to delete lead');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Edit Lead
  const openEditSlideOver = (contact: any) => {
    setSelectedContact(contact);
    setActiveTab('profile');
    setFormData({
      name: contact.name || '', email: contact.email || '', phone: contact.phone || '',
      industry: contact.industry || '', jobTitle: contact.jobTitle || '',
      linkedinUrl: contact.linkedinUrl || '', city: contact.city || '',
      companyName: contact.companyName || '',
      leadStatus: contact.flywheelProfile?.leadStatus || 'NEW',
      lifecycleStage: contact.flywheelProfile?.lifecycleStage || 'LEAD'
    });
  };

  useEffect(() => {
    if (selectedContact && activeTab === 'timeline') {
      const fetchTimeline = async () => {
        setLoadingTimeline(true);
        try {
          const res = await fetch(`/api/admin/flywheel/timeline?contactId=${selectedContact.id}`);
          if (res.ok) {
            const data = await res.json();
            setTimeline(data.data || []);
          }
        } catch(e) {
          console.error(e);
        } finally {
          setLoadingTimeline(false);
        }
      };
      fetchTimeline();
    }
  }, [selectedContact, activeTab]);

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContact) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/flywheel/leads/${selectedContact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) { setSelectedContact(null); fetchContacts(); }
    } finally { setSaving(false); }
  };

  // Delete Lead
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    try {
      const res = await fetch(`/api/admin/flywheel/leads/${id}`, { method: 'DELETE' });
      if (res.ok) fetchContacts();
    } catch (e) { console.error(e); }
  };

  // Import CSV
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);

    const processData = async (data: any[]) => {
      try {
        const leads = data.map((row: any) => ({
          timestamp: row['Timestamp'] || row.timestamp || row.createdAt || undefined,
          name: row['Full Name'] || row.Name || row.name || row.First_Name || 'Unknown',
          email: row['Email Address'] || row.Email || row.email || row.Email_Address || '',
          phone: row['Phone Number (With Country Code)'] || row.Phone || row.phone || '',
          jobTitle: row['Current Job Title'] || row.jobTitle || row['Job Title'] || ''
        })).filter((l: any) => l.email || l.phone);

        const res = await fetch('/api/admin/flywheel/leads/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leads, brandId: activeBrand })
        });
        const respData = await res.json();
        if (respData.success) {
          setImportResult(`Imported ${respData.importedCount} new leads (${respData.existingCount} updated).`);
          fetchContacts();
          setTimeout(() => setIsImportModalOpen(false), 2000);
        } else { setImportResult(`Error: ${respData.error}`); }
      } catch { setImportResult('An error occurred during import.'); }
      finally { setImporting(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
    };

    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (results) => processData(results.data),
      error: () => { setImportResult('Failed to parse CSV.'); setImporting(false); }
    });
  };

  // Selection
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === contacts.length) { setSelectedIds(new Set()); }
    else { setSelectedIds(new Set(contacts.map(c => c.id))); }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} selected leads?`)) return;
    setLoading(true);
    try {
      const promises = Array.from(selectedIds).map(id => fetch(`/api/admin/flywheel/leads/${id}`, { method: 'DELETE' }));
      await Promise.all(promises);
      setSelectedIds(new Set());
      fetchContacts();
    } catch (err) {
      console.error(err);
      alert('Failed to delete some leads');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoAssign = async () => {
    if (!confirm(selectedIds.size > 0 
      ? `Run Smart Assign on ${selectedIds.size} selected leads?` 
      : 'Run Smart Assign on ALL leads?')) return;
      
    setLoading(true);
    try {
      const res = await fetch('/api/admin/flywheel/leads/auto-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedIds: Array.from(selectedIds) })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Successfully updated ${data.updatedCount} leads.`);
        setSelectedIds(new Set());
        fetchContacts();
      } else {
        alert('Failed to auto-assign: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred during smart assignment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
                <IconUser size={20} style={{ color: '#fff' }} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Audience & Leads</h1>
            </div>
            <p className="text-slate-500 mt-1 ml-[52px]">
              {pagination.total} contacts · Page {pagination.page} of {pagination.totalPages || 1}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {selectedIds.size > 0 && (
              <button onClick={handleBulkDelete} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 text-red-600 font-medium text-sm shadow-sm hover:bg-red-100 transition-colors">
                <IconX size={15} /> Delete Selected ({selectedIds.size})
              </button>
            )}
            <button onClick={handleAutoAssign} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 font-medium text-sm shadow-sm hover:bg-indigo-100 transition-colors">
              <IconRefresh size={15} /> Smart Assign
            </button>
            <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-medium text-sm shadow-sm hover:bg-slate-50 transition-colors">
              <IconPlus size={15} /> Create Lead
            </button>
            <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-medium text-sm shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5" style={{ background: brand.gradient }}>
              <IconInbox size={16} /> Import Excel / CSV
            </button>
          </div>
        </div>

        {/* Search + Filters Bar */}
        <div className="card p-4 mb-6">
          <form onSubmit={handleSearch} className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[240px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><IconSearch size={15} /></span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, phone, company, ID..." className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:bg-white outline-none transition-colors" style={{ '--tw-ring-color': brand.primaryColor } as any} />
            </div>
            <button type="button" onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <IconFilter size={14} /> Filters {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-blue-500" />}
            </button>
            <button type="submit" className="px-4 py-2.5 rounded-lg text-white font-medium text-sm" style={{ background: brand.primaryColor }}>Search</button>
            {hasActiveFilters && (
              <button type="button" onClick={clearFilters} className="flex items-center gap-1 px-3 py-2.5 text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors">
                <IconX size={14} /> Clear
              </button>
            )}
            <span className="ml-auto text-xs text-slate-400">{pagination.total} results</span>
          </form>

          {/* Filter Dropdowns */}
          {showFilters && (
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 flex-wrap">
              <select value={stageFilter} onChange={e => setStageFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 outline-none">
                <option value="">All Stages</option>
                <option value="SUBSCRIBER">Subscriber</option>
                <option value="LEAD">Lead</option>
                <option value="MQL">MQL</option>
                <option value="SQL">SQL</option>
                <option value="CUSTOMER">Customer</option>
                <option value="CHURNED">Churned</option>
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 outline-none">
                <option value="">All Statuses</option>
                <option value="NEW">New</option>
                <option value="OPEN">Open</option>
                <option value="CONTACTED">Contacted</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="QUALIFIED">Qualified</option>
                <option value="UNQUALIFIED">Unqualified</option>
              </select>
              <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 outline-none">
                <option value="">All Sources</option>
                <option value="MANUAL">Manual</option>
                <option value="EXCEL_IMPORT">Excel Import</option>
                <option value="CATALYST">Catalyst</option>
                <option value="RIPPLE_NEXUS">Ripple Nexus</option>
                <option value="WEBSITE">Website</option>
                <option value="LINKEDIN">LinkedIn</option>
                <option value="REFERRAL">Referral</option>
              </select>
            </div>
          )}
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="card p-3 mb-4 flex items-center gap-4 bg-blue-50 border-blue-200">
            <span className="text-sm font-semibold text-blue-700">{selectedIds.size} selected</span>
            <button onClick={() => setSelectedIds(new Set())} className="text-sm text-blue-600 hover:text-blue-800 font-medium">Deselect all</button>
          </div>
        )}

        {/* Data Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-3.5 w-10">
                    <input type="checkbox" checked={selectedIds.size === contacts.length && contacts.length > 0} onChange={toggleSelectAll} className="rounded border-slate-300" />
                  </th>
                  <th className="px-4 py-3.5">ID</th>
                  <th className="px-4 py-3.5">Contact</th>
                  <th className="px-4 py-3.5">Company / Role</th>
                  <th className="px-4 py-3.5">Stage</th>
                  <th className="px-4 py-3.5 text-center">Score</th>
                  <th className="px-4 py-3.5 text-right">Revenue</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}><td colSpan={8} className="px-4 py-4"><div className="skeleton h-4 rounded" style={{ width: `${60 + Math.random() * 30}%` }} /></td></tr>
                  ))
                ) : contacts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-50 text-slate-300 mb-4 border border-slate-100"><IconUser size={28} /></div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">{hasActiveFilters ? 'No contacts match your filters' : 'Your audience is empty'}</h3>
                      <p className="text-slate-500 text-sm mb-4">{hasActiveFilters ? 'Try adjusting your search criteria.' : 'Import a CSV or create your first lead to get started.'}</p>
                      {!hasActiveFilters && (
                        <button onClick={() => setIsImportModalOpen(true)} className="px-4 py-2 text-white rounded-lg text-sm font-medium" style={{ background: brand.primaryColor }}>
                          <IconPlus size={14} className="inline mr-1" /> Import Contacts
                        </button>
                      )}
                    </td>
                  </tr>
                ) : contacts.map(contact => {
                  const stage = contact.flywheelProfile?.lifecycleStage || 'LEAD';
                  const stageStyle = STAGE_COLORS[stage] || STAGE_COLORS.LEAD;
                  const engScore = contact.flywheelProfile?.engagementScore || 0;
                  const revenue = Number(contact.flywheelProfile?.totalRevenue || 0);
                  return (
                    <tr key={contact.id} className="hover:bg-slate-50/70 transition-colors group cursor-pointer" onClick={() => openEditSlideOver(contact)}>
                      <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(contact.id)} onChange={() => toggleSelect(contact.id)} className="rounded border-slate-300" />
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs font-semibold text-slate-400">{contact.displayId || '—'}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0" style={{ background: stageStyle.color }}>
                            {contact.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 text-sm">{contact.name}</div>
                            <div className="text-slate-400 text-xs">{contact.email || contact.phone || 'No info'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs">
                        <div className="text-slate-800 font-medium">{contact.jobTitle || '—'}</div>
                        <div className="text-slate-400">{contact.companyName || contact.industry || '—'}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: stageStyle.bg, color: stageStyle.color }}>
                          {stage}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`text-sm font-bold ${engScore >= 20 ? 'text-emerald-600' : engScore >= 10 ? 'text-amber-600' : 'text-slate-400'}`}>
                          {engScore > 0 ? engScore : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {revenue > 0 ? (
                          <span className="text-sm font-bold text-emerald-600">₹{revenue.toLocaleString()}</span>
                        ) : (
                          <span className="text-sm text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEditSlideOver(contact)} className="px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 rounded-md text-xs font-medium shadow-sm transition-colors">View</button>
                          <button onClick={() => deleteLead(contact.id)} className="px-2.5 py-1.5 bg-white border border-slate-200 text-red-600 hover:bg-red-50 rounded-md text-xs font-medium shadow-sm transition-colors">Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <span className="text-sm text-slate-500">
                Showing {((pagination.page - 1) * pagination.pageSize) + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
              </span>
              <div className="flex gap-1.5">
                <button disabled={pagination.page <= 1} onClick={() => fetchContacts(pagination.page - 1)} className="px-3 py-1.5 rounded-md text-sm font-medium bg-white border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors">Previous</button>
                {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                  const p = i + Math.max(1, pagination.page - 2);
                  if (p > pagination.totalPages) return null;
                  return (
                    <button key={p} onClick={() => fetchContacts(p)} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${p === pagination.page ? 'text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`} style={p === pagination.page ? { background: brand.primaryColor } : {}}>
                      {p}
                    </button>
                  );
                })}
                <button disabled={pagination.page >= pagination.totalPages} onClick={() => fetchContacts(pagination.page + 1)} className="px-3 py-1.5 rounded-md text-sm font-medium bg-white border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── IMPORT MODAL ── */}
      {/* ... (same as before, omitted for brevity but intact in real file conceptually, but I must provide full file) ... */}
      <Dialog.Root open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl p-8 shadow-2xl w-[90vw] max-w-md z-50 animate-in fade-in zoom-in-95">
            <Dialog.Title className="text-xl font-bold text-slate-900 mb-2">Import CSV</Dialog.Title>
            <Dialog.Description className="text-slate-500 mb-6">Upload a CSV file with the 5 required columns.</Dialog.Description>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50 hover:bg-slate-100 transition-colors">
              <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
              <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: brand.primaryLight, color: brand.primaryColor }}><IconInbox size={24} /></div>
              <button onClick={() => fileInputRef.current?.click()} disabled={importing} className="px-4 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50">
                {importing ? 'Processing...' : 'Select File'}
              </button>
            </div>
            {importResult && (
              <div className={`mt-4 p-4 rounded-lg text-sm font-medium ${importResult.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{importResult}</div>
            )}
            <div className="mt-6 flex justify-end">
              <button onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 text-slate-500 font-medium hover:text-slate-900">Close</button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* ── CREATE LEAD MODAL ── */}
      <Dialog.Root open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl p-8 shadow-2xl w-[90vw] max-w-lg z-50 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <Dialog.Title className="text-xl font-bold text-slate-900 mb-1">Create New Lead</Dialog.Title>
            <Dialog.Description className="text-slate-500 mb-6">Add a new contact to your CRM pipeline.</Dialog.Description>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'name', label: 'Full Name *', required: true },
                  { key: 'email', label: 'Email', type: 'email' },
                  { key: 'phone', label: 'Phone' },
                  { key: 'jobTitle', label: 'Job Title' },
                  { key: 'companyName', label: 'Company' },
                  { key: 'industry', label: 'Industry' },
                  { key: 'city', label: 'City/Region' },
                  { key: 'linkedinUrl', label: 'LinkedIn URL' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">{field.label}</label>
                    <input required={field.required} type={field.type || 'text'} value={formData[field.key] || ''} onChange={e => setFormData({ ...formData, [field.key]: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 outline-none text-sm bg-slate-50 focus:bg-white" style={{ '--tw-ring-color': brand.primaryColor } as any} />
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 text-slate-500 font-medium hover:bg-slate-50 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 text-white font-medium rounded-lg shadow-sm text-sm" style={{ background: brand.gradient }}>{saving ? 'Creating...' : 'Create Lead'}</button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* ── 360° EDIT SLIDE-OVER ── */}
      <Dialog.Root open={!!selectedContact} onOpenChange={open => !open && setSelectedContact(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40" />
          <Dialog.Content className="fixed top-0 right-0 h-full w-[90vw] max-w-lg bg-white shadow-2xl z-50 animate-in slide-in-from-right duration-300 flex flex-col">
            {selectedContact && (
              <>
                <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                  <div className="flex items-start justify-between">
                    <div>
                      <Dialog.Title className="text-xl font-bold text-slate-900">{selectedContact.name}</Dialog.Title>
                      <Dialog.Description className="text-sm text-slate-500 mt-0.5">{selectedContact.email || selectedContact.phone || 'Contact Profile'}</Dialog.Description>
                    </div>
                    <Dialog.Close asChild>
                      <button className="p-2 rounded-lg hover:bg-slate-100 transition-colors"><IconX size={18} className="text-slate-400" /></button>
                    </Dialog.Close>
                  </div>
                  <div className="mt-4 flex gap-4 border-b border-slate-200">
                    <button 
                      onClick={() => setActiveTab('profile')} 
                      className={`pb-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'profile' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                      Profile Details
                    </button>
                    <button 
                      onClick={() => setActiveTab('timeline')} 
                      className={`pb-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'timeline' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                      Unified Timeline
                    </button>
                  </div>
                </div>

                <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
                  {activeTab === 'profile' ? (
                    <form id="edit-form" onSubmit={handleUpdateSubmit} className="space-y-5 bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { key: 'name', label: 'Full Name', required: true },
                          { key: 'email', label: 'Email', type: 'email' },
                          { key: 'phone', label: 'Phone' },
                          { key: 'jobTitle', label: 'Job Title' },
                          { key: 'companyName', label: 'Company' },
                          { key: 'industry', label: 'Industry' },
                          { key: 'city', label: 'City' },
                        ].map(field => (
                          <div key={field.key}>
                            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">{field.label}</label>
                            <input required={field.required} type={field.type || 'text'} value={formData[field.key] || ''} onChange={e => setFormData({ ...formData, [field.key]: e.target.value })} className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:ring-2 outline-none text-sm" style={{ '--tw-ring-color': brand.primaryColor } as any} />
                          </div>
                        ))}
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">LinkedIn URL</label>
                        <input value={formData.linkedinUrl || ''} onChange={e => setFormData({ ...formData, linkedinUrl: e.target.value })} className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:ring-2 outline-none text-sm" style={{ '--tw-ring-color': brand.primaryColor } as any} />
                      </div>

                      <div className="border-t border-slate-100 pt-5">
                        <h4 className="font-semibold text-slate-900 mb-3">Pipeline Position</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">Lead Status</label>
                            <select value={formData.leadStatus || 'NEW'} onChange={e => setFormData({ ...formData, leadStatus: e.target.value })} className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm">
                              <option value="NEW">New</option><option value="OPEN">Open</option><option value="CONTACTED">Contacted</option><option value="IN_PROGRESS">In Progress</option><option value="QUALIFIED">Qualified</option><option value="UNQUALIFIED">Unqualified</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">Lifecycle Stage</label>
                            <select value={formData.lifecycleStage || 'LEAD'} onChange={e => setFormData({ ...formData, lifecycleStage: e.target.value })} className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm">
                              <option value="SUBSCRIBER">Subscriber</option><option value="LEAD">Lead</option><option value="MQL">MQL</option><option value="SQL">SQL</option><option value="CUSTOMER">Customer</option><option value="CHURNED">Churned</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Metrics Summary */}
                      <div className="border-t border-slate-100 pt-5">
                        <h4 className="font-semibold text-slate-900 mb-3">Metrics</h4>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                            <div className="text-lg font-bold text-amber-600">{selectedContact.flywheelProfile?.engagementScore || 0}</div>
                            <div className="text-xs text-slate-500">Score</div>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                            <div className="text-lg font-bold text-emerald-600">₹{Number(selectedContact.flywheelProfile?.totalRevenue || 0).toLocaleString()}</div>
                            <div className="text-xs text-slate-500">Revenue</div>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                            <div className="text-lg font-bold text-blue-600">{selectedContact._count?.flywheelCampaignLeads || 0}</div>
                            <div className="text-xs text-slate-500">Campaigns</div>
                          </div>
                        </div>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-4">
                      {loadingTimeline ? (
                        <div className="flex justify-center py-12"><div className="animate-spin text-slate-400"><IconRefresh size={24} /></div></div>
                      ) : timeline.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">No events found in timeline.</div>
                      ) : (
                        <div className="relative pl-6 border-l-2 border-slate-200 space-y-6 pb-6">
                          {timeline.map((event: any) => (
                            <div key={event.id} className="relative">
                              <div className={`absolute -left-[31px] w-4 h-4 rounded-full border-4 border-white ${event.source === 'catalyst' ? 'bg-amber-500' : event.source === 'ripple_nexus' ? 'bg-blue-600' : 'bg-emerald-500'}`} />
                              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                                <div className="flex justify-between items-start mb-1">
                                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{event.type.replace(/_/g, ' ')}</span>
                                  <span className="text-xs text-slate-400">{new Date(event.timestamp).toLocaleString()}</span>
                                </div>
                                <h4 className="font-bold text-slate-900">{event.title}</h4>
                                {event.description && <p className="text-sm text-slate-600 mt-1">{event.description}</p>}
                                <div className="mt-2 text-xs font-medium text-slate-400">Source: {event.source.replace('_', ' ').toUpperCase()}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {activeTab === 'profile' && (
                  <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <Dialog.Close asChild>
                      <button className="px-4 py-2 text-slate-500 font-medium hover:bg-slate-50 rounded-lg text-sm transition-colors">Cancel</button>
                    </Dialog.Close>
                    <button type="submit" form="edit-form" disabled={saving} className="px-6 py-2 text-white font-medium rounded-lg shadow-sm text-sm transition-transform active:scale-95" style={{ background: brand.gradient }}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                )}
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </AppShell>
  );
}
