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
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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
            setTimeout(() => setIsModalOpen(false), 2000);
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
    <main className="max-w-7xl mx-auto p-8 font-sans bg-gray-50 min-h-screen text-gray-900">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Audience & Leads</h1>
          <p className="text-gray-500 mt-1">Manage your centralized CRM contacts and segment lists.</p>
        </div>

        <Dialog.Root open={isModalOpen} onOpenChange={setIsModalOpen}>
          <Dialog.Trigger asChild>
            <button 
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-medium shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5"
              style={{ background: brand.gradient }}
            >
              <IconPlus size={18} />
              Import Audience
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 transition-opacity" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl p-8 shadow-2xl w-[90vw] max-w-md z-50 animate-in fade-in zoom-in-95 duration-200">
              <Dialog.Title className="text-xl font-bold text-gray-900 mb-2">Import CSV</Dialog.Title>
              <Dialog.Description className="text-gray-500 mb-6">
                Upload a CSV file containing your leads. Ensure columns are named Name, Email, and Phone.
              </Dialog.Description>
              
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
                <input 
                  type="file" 
                  accept=".csv" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
                <div 
                  className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4"
                  style={{ background: brand.primaryLight, color: brand.primaryColor }}
                >
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
                <Dialog.Close asChild>
                  <button className="px-4 py-2 text-gray-500 font-medium hover:text-gray-900">Close</button>
                </Dialog.Close>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
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
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Lifecycle Stage</th>
                <th className="px-6 py-4">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400">Loading audience data...</td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 text-gray-300 mb-4">
                      <IconUser size={32} />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-1">Your audience is empty</h3>
                    <p className="text-gray-500">Import a CSV file to get started with Flywheel Automation.</p>
                  </td>
                </tr>
              ) : (
                contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xs uppercase">
                        {contact.name.substring(0, 2)}
                      </div>
                      {contact.name}
                    </td>
                    <td className="px-6 py-4 text-gray-500">{contact.email || '-'}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {contact.flywheelProfile?.lifecycleStage || 'LEAD'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-xs tracking-wider uppercase">
                      {contact.contactSource?.replace('_', ' ') || 'UNKNOWN'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
