'use client';

import { useState, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import * as Dialog from '@radix-ui/react-dialog';
import { useBrand } from '@/components/BrandProvider';
import { getBrand } from '@/lib/brand/registry';
import { IconInbox, IconUser, IconPlus, IconTrendUp } from '@/components/Icons';

export default function FlywheelLeadsPage() {
  const { activeBrand } = useBrand();
  const brand = getBrand(activeBrand === 'all' ? 'catalyst' : activeBrand);
  
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Forms & State
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<any>({});
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, [activeBrand]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/flywheel/leads?brandId=${activeBrand}`);
      if (res.ok) {
        const data = await res.json();
        setContacts(data.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch leads', e);
    } finally {
      setLoading(false);
    }
  };

  // ── CREATE LEAD ──
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
      } else {
        alert('Failed to create lead');
      }
    } finally {
      setSaving(false);
    }
  };

  // ── UPDATE LEAD ──
  const openEditModal = (contact: any) => {
    setSelectedLeadId(contact.id);
    setFormData({
      name: contact.name || '',
      email: contact.email || '',
      phone: contact.phone || '',
      industry: contact.industry || '',
      jobTitle: contact.jobTitle || '',
      linkedinUrl: contact.linkedinUrl || '',
      city: contact.city || '',
      leadStatus: contact.flywheelProfile?.leadStatus || 'NEW',
      lifecycleStage: contact.flywheelProfile?.lifecycleStage || 'LEAD'
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/flywheel/leads/${selectedLeadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setIsEditModalOpen(false);
        fetchContacts();
      }
    } finally {
      setSaving(false);
    }
  };

  // ── DELETE LEAD ──
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to completely delete this lead?')) return;
    try {
      const res = await fetch(`/api/admin/flywheel/leads/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchContacts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ── IMPORT LEAD ──
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const leads = results.data.map((row: any) => ({
            name: row.Name || row.name || row.First_Name || 'Unknown',
            email: row.Email || row.email || row.Email_Address || '',
            phone: row.Phone || row.phone || ''
          })).filter(l => l.email || l.phone);

          const res = await fetch('/api/admin/flywheel/leads/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leads, brandId: activeBrand })
          });

          const data = await res.json();
          if (data.success) {
            setImportResult(`Successfully imported ${data.importedCount} new leads (${data.existingCount} updated).`);
            fetchContacts();
            setTimeout(() => setIsImportModalOpen(false), 2000);
          } else {
            setImportResult(`Error: ${data.error}`);
          }
        } catch (error) {
          setImportResult('An error occurred during import.');
        } finally {
          setImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: () => {
        setImportResult('Failed to parse CSV.');
        setImporting(false);
      }
    });
  };

  // Compute metrics
  const totalLeads = contacts.length;
  const activeLeads = contacts.filter(c => c.status === 'ACTIVE').length;
  const newLeads = contacts.filter(c => c.flywheelProfile?.leadStatus === 'NEW').length;

  return (
    <main className="max-w-7xl mx-auto p-8 font-sans bg-gray-50 min-h-screen text-gray-900 overflow-x-hidden">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Audience & Leads</h1>
          <p className="text-gray-500 mt-1">Manage your centralized CRM contacts and segment lists.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Create Lead Button */}
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-700 font-medium shadow-sm transition-all hover:bg-gray-50"
          >
            <IconPlus size={18} />
            Create Lead
          </button>

          {/* Import Button */}
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-medium shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5"
            style={{ background: brand.gradient }}
          >
            <IconInbox size={18} />
            Import CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-shadow hover:shadow-md">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: brand.primaryLight, color: brand.primaryColor }}>
            <IconUser size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Audience</p>
            <h3 className="text-2xl font-bold text-gray-900">{totalLeads}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-shadow hover:shadow-md">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600">
            <IconTrendUp size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Active Contacts</p>
            <h3 className="text-2xl font-bold text-gray-900">{activeLeads}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-shadow hover:shadow-md">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600">
            <IconInbox size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">New (Unprocessed)</p>
            <h3 className="text-2xl font-bold text-gray-900">{newLeads}</h3>
          </div>
        </div>
      </div>

      {/* Data Grid */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/50 border-b border-gray-200 text-xs uppercase font-semibold text-gray-500">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Name & Details</th>
                <th className="px-6 py-4">Firmographics</th>
                <th className="px-6 py-4">Lifecycle Stage</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">Loading audience data...</td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 text-gray-300 mb-4">
                      <IconUser size={32} />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-1">Your audience is empty</h3>
                    <p className="text-gray-500">Import a CSV file to get started with Flywheel Automation.</p>
                  </td>
                </tr>
              ) : (
                contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-gray-500">
                      {contact.displayId || '—'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-xs uppercase">
                          {contact.name.substring(0, 2)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{contact.name}</div>
                          <div className="text-gray-500 text-xs">{contact.email || contact.phone || 'No contact info'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <div className="text-gray-900 font-medium">{contact.jobTitle || 'Unknown Role'}</div>
                      <div className="text-gray-500">{contact.industry || contact.companyName || 'Unknown Industry'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {contact.flywheelProfile?.lifecycleStage || 'LEAD'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => openEditModal(contact)}
                          className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 hover:text-blue-600 rounded-md text-xs font-medium shadow-sm transition-colors"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDelete(contact.id)}
                          className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 hover:text-red-600 rounded-md text-xs font-medium shadow-sm transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── IMPORT MODAL ── */}
      <Dialog.Root open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl p-8 shadow-2xl w-[90vw] max-w-md z-50 animate-in fade-in zoom-in-95">
            <Dialog.Title className="text-xl font-bold text-gray-900 mb-2">Import CSV</Dialog.Title>
            <Dialog.Description className="text-gray-500 mb-6">
              Upload a CSV file containing your leads. Ensure columns are named Name, Email, and Phone.
            </Dialog.Description>
            
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
              <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
              <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: brand.primaryLight, color: brand.primaryColor }}>
                <IconInbox size={24} />
              </div>
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
              >
                {importing ? 'Processing File...' : 'Select CSV File'}
              </button>
            </div>

            {importResult && (
              <div className={`mt-4 p-4 rounded-lg text-sm font-medium ${importResult.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {importResult}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 text-gray-500 font-medium hover:text-gray-900">Close</button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* ── CREATE LEAD MODAL ── */}
      <Dialog.Root open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl p-8 shadow-2xl w-[90vw] max-w-lg z-50 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <Dialog.Title className="text-xl font-bold text-gray-900 mb-1">Create New Lead</Dialog.Title>
            <Dialog.Description className="text-gray-500 mb-6">Manually insert a new record into your CRM.</Dialog.Description>
            
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Full Name *</label>
                  <input required value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 rounded border border-gray-300 focus:ring-2 outline-none" style={{ '--tw-ring-color': brand.primaryColor } as any} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Email</label>
                  <input type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2 rounded border border-gray-300 focus:ring-2 outline-none" style={{ '--tw-ring-color': brand.primaryColor } as any} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Phone</label>
                  <input value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-3 py-2 rounded border border-gray-300 focus:ring-2 outline-none" style={{ '--tw-ring-color': brand.primaryColor } as any} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Job Title</label>
                  <input value={formData.jobTitle || ''} onChange={e => setFormData({...formData, jobTitle: e.target.value})} className="w-full px-3 py-2 rounded border border-gray-300 focus:ring-2 outline-none" style={{ '--tw-ring-color': brand.primaryColor } as any} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Industry</label>
                  <input value={formData.industry || ''} onChange={e => setFormData({...formData, industry: e.target.value})} className="w-full px-3 py-2 rounded border border-gray-300 focus:ring-2 outline-none" style={{ '--tw-ring-color': brand.primaryColor } as any} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">City/Region</label>
                  <input value={formData.city || ''} onChange={e => setFormData({...formData, city: e.target.value})} className="w-full px-3 py-2 rounded border border-gray-300 focus:ring-2 outline-none" style={{ '--tw-ring-color': brand.primaryColor } as any} />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 text-gray-500 font-medium hover:bg-gray-50 rounded-lg">Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 text-white font-medium rounded-lg shadow-sm" style={{ background: brand.gradient }}>
                  {saving ? 'Creating...' : 'Create Lead'}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* ── EDIT LEAD SLIDE-OVER ── */}
      <Dialog.Root open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 transition-opacity" />
          <Dialog.Content className="fixed top-0 right-0 h-full w-[90vw] max-w-md bg-white shadow-2xl z-50 animate-in slide-in-from-right duration-300 flex flex-col">
            <div className="p-6 border-b border-gray-100 bg-gray-50">
              <Dialog.Title className="text-xl font-bold text-gray-900">Edit Lead Profile</Dialog.Title>
              <Dialog.Description className="text-gray-500 text-sm mt-1">Update firmographics and lifecycle stage.</Dialog.Description>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <form id="edit-form" onSubmit={handleUpdateSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Full Name</label>
                  <input required value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 bg-gray-50 rounded border border-gray-200 focus:bg-white focus:ring-2 outline-none" style={{ '--tw-ring-color': brand.primaryColor } as any} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Email</label>
                    <input type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2 bg-gray-50 rounded border border-gray-200 focus:bg-white focus:ring-2 outline-none" style={{ '--tw-ring-color': brand.primaryColor } as any} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Phone</label>
                    <input value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-3 py-2 bg-gray-50 rounded border border-gray-200 focus:bg-white focus:ring-2 outline-none" style={{ '--tw-ring-color': brand.primaryColor } as any} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Job Title</label>
                    <input value={formData.jobTitle || ''} onChange={e => setFormData({...formData, jobTitle: e.target.value})} className="w-full px-3 py-2 bg-gray-50 rounded border border-gray-200 focus:bg-white focus:ring-2 outline-none" style={{ '--tw-ring-color': brand.primaryColor } as any} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Industry</label>
                    <input value={formData.industry || ''} onChange={e => setFormData({...formData, industry: e.target.value})} className="w-full px-3 py-2 bg-gray-50 rounded border border-gray-200 focus:bg-white focus:ring-2 outline-none" style={{ '--tw-ring-color': brand.primaryColor } as any} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">LinkedIn URL</label>
                    <input value={formData.linkedinUrl || ''} onChange={e => setFormData({...formData, linkedinUrl: e.target.value})} className="w-full px-3 py-2 bg-gray-50 rounded border border-gray-200 focus:bg-white focus:ring-2 outline-none" style={{ '--tw-ring-color': brand.primaryColor } as any} />
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-5 mt-5">
                  <h4 className="font-semibold text-gray-900 mb-3">Flywheel Status</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Lead Status</label>
                      <select value={formData.leadStatus || 'NEW'} onChange={e => setFormData({...formData, leadStatus: e.target.value})} className="w-full px-3 py-2 bg-gray-50 rounded border border-gray-200 outline-none">
                        <option value="NEW">New</option>
                        <option value="OPEN">Open</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="UNQUALIFIED">Unqualified</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Lifecycle Stage</label>
                      <select value={formData.lifecycleStage || 'LEAD'} onChange={e => setFormData({...formData, lifecycleStage: e.target.value})} className="w-full px-3 py-2 bg-gray-50 rounded border border-gray-200 outline-none">
                        <option value="SUBSCRIBER">Subscriber</option>
                        <option value="LEAD">Lead</option>
                        <option value="MQL">MQL (Marketing Qualified)</option>
                        <option value="SQL">SQL (Sales Qualified)</option>
                        <option value="CUSTOMER">Customer</option>
                      </select>
                    </div>
                  </div>
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-gray-500 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
              <button type="submit" form="edit-form" disabled={saving} className="px-6 py-2 text-white font-medium rounded-lg shadow-sm" style={{ background: brand.gradient }}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

    </main>
  );
}
