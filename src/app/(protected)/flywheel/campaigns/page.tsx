'use client';

import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useBrand } from '@/components/BrandProvider';
import { getBrand } from '@/lib/brand/registry';
import { IconPlus, IconTrendUp, IconList, IconInbox, IconCheck } from '@/components/Icons';

export default function FlywheelCampaignsPage() {
  const { activeBrand } = useBrand();
  const brand = getBrand(activeBrand === 'all' ? 'catalyst' : activeBrand);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // New Campaign Form State
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [contentHtml, setContentHtml] = useState('');

  useEffect(() => {
    fetchCampaigns();
  }, [activeBrand]);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/flywheel/campaigns?brandId=${activeBrand}`);
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch campaigns', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await fetch('/api/admin/flywheel/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          brandId: activeBrand,
          type: 'ONE_OFF',
          steps: [
            { subject, contentHtml, delayHours: 0 }
          ]
        })
      });

      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        setName('');
        setSubject('');
        setContentHtml('');
        fetchCampaigns();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      alert('Failed to create campaign');
    } finally {
      setCreating(false);
    }
  };

  const handleDispatch = async (campaignId: string) => {
    if (!confirm('Are you sure you want to dispatch this campaign to ALL leads?')) return;

    try {
      const leadsRes = await fetch('/api/admin/flywheel/leads');
      const leadsData = await leadsRes.json();
      const contactIds = leadsData.data.map((c: any) => c.id);

      if (contactIds.length === 0) {
        alert('No leads to dispatch to.');
        return;
      }

      const res = await fetch(`/api/admin/flywheel/campaigns/${campaignId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds })
      });

      const data = await res.json();
      if (data.success) {
        // We could use a beautiful toast here, but simple alert for V1
        alert('Campaign dispatched to queue! The Cron job will process it.');
        fetchCampaigns();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      alert('Failed to dispatch campaign');
    }
  };

  // Compute metrics
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE').length;
  const totalLeadsQueued = campaigns.reduce((sum, c) => sum + (c._count?.leads || 0), 0);

  return (
    <main className="max-w-7xl mx-auto p-8 font-sans bg-gray-50 min-h-screen text-gray-900">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Marketing Campaigns</h1>
          <p className="text-gray-500 mt-1">Design automated email sequences and monitor queue delivery.</p>
        </div>

        <Dialog.Root open={isModalOpen} onOpenChange={setIsModalOpen}>
          <Dialog.Trigger asChild>
            <button 
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-medium shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5"
              style={{ background: brand.gradient }}
            >
              <IconPlus size={18} />
              New Campaign
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 transition-opacity" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl p-8 shadow-2xl w-[90vw] max-w-2xl z-50 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
              <Dialog.Title className="text-2xl font-bold text-gray-900 mb-1">Create Campaign</Dialog.Title>
              <Dialog.Description className="text-gray-500 mb-6">
                Draft your marketing message. The email will automatically be wrapped in your premium {brand.name} layout.
              </Dialog.Description>
              
              <form onSubmit={handleCreateCampaign} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Internal Campaign Name</label>
                  <input 
                    required 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:border-transparent outline-none transition-shadow bg-gray-50"
                    placeholder="e.g. Summer Reactivation Blast"
                    style={{ '--tw-ring-color': brand.primaryColor } as any}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Email Subject Line</label>
                  <input 
                    required 
                    value={subject} 
                    onChange={(e) => setSubject(e.target.value)} 
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:border-transparent outline-none transition-shadow bg-gray-50"
                    placeholder="e.g. Exclusive offer inside"
                    style={{ '--tw-ring-color': brand.primaryColor } as any}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">HTML Content</label>
                  <textarea 
                    required 
                    value={contentHtml} 
                    onChange={(e) => setContentHtml(e.target.value)} 
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:border-transparent outline-none transition-shadow bg-gray-50 font-mono text-sm"
                    rows={8}
                    placeholder="<p>Hello there...</p>"
                    style={{ '--tw-ring-color': brand.primaryColor } as any}
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    Variables like {"{{firstName}}"} are supported (Coming soon). Trackers and Unsubscribe links are auto-injected.
                  </p>
                </div>
                
                <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                  <Dialog.Close asChild>
                    <button type="button" className="px-5 py-2.5 text-gray-500 font-medium hover:text-gray-900 rounded-lg">Cancel</button>
                  </Dialog.Close>
                  <button 
                    type="submit" 
                    disabled={creating}
                    className="px-6 py-2.5 text-white font-medium rounded-lg shadow-sm hover:shadow-md transition-all disabled:opacity-70 flex items-center gap-2"
                    style={{ background: brand.primaryColor }}
                  >
                    {creating ? 'Saving...' : 'Save Draft'}
                  </button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-shadow hover:shadow-md">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gray-100 text-gray-600">
            <IconList size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Campaigns</p>
            <h3 className="text-2xl font-bold text-gray-900">{totalCampaigns}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-shadow hover:shadow-md">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600">
            <IconTrendUp size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Active Sequences</p>
            <h3 className="text-2xl font-bold text-gray-900">{activeCampaigns}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-shadow hover:shadow-md">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: brand.primaryLight, color: brand.primaryColor }}>
            <IconInbox size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Emails in Queue</p>
            <h3 className="text-2xl font-bold text-gray-900">{totalLeadsQueued}</h3>
          </div>
        </div>
      </div>

      {/* Data Grid */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/50 border-b border-gray-200 text-xs uppercase font-semibold text-gray-500">
              <tr>
                <th className="px-6 py-4">Campaign Name</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Queue Size</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400">Loading campaigns...</td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 text-gray-300 mb-4">
                      <IconTrendUp size={32} />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-1">No campaigns created yet</h3>
                    <p className="text-gray-500">Create your first automated email sequence to engage your audience.</p>
                  </td>
                </tr>
              ) : (
                campaigns.map((camp) => (
                  <tr key={camp.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{camp.name}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${camp.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'}`}>
                        {camp.status === 'ACTIVE' && <IconCheck size={12} className="mr-1" />}
                        {camp.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 font-mono text-sm">{camp._count?.leads || 0}</td>
                    <td className="px-6 py-4 text-right">
                      {camp.status === 'DRAFT' && (
                        <button 
                          onClick={() => handleDispatch(camp.id)}
                          className="px-4 py-1.5 bg-gray-900 text-white rounded-md text-xs font-medium shadow-sm hover:bg-gray-800 transition-colors"
                        >
                          Dispatch to All
                        </button>
                      )}
                      {camp.status === 'ACTIVE' && (
                        <span className="text-xs text-emerald-600 font-medium">Processing...</span>
                      )}
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
