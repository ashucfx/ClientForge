'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { useBrand } from '@/components/BrandProvider';
import { getBrand } from '@/lib/brand/registry';
import { IconCheck, IconX, IconRefresh, IconZap, IconUser } from '@/components/Icons';

export default function FlywheelActionFeed() {
  const { activeBrand } = useBrand();
  const brand = getBrand(activeBrand === 'all' ? 'catalyst' : activeBrand);

  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActions = async (forceEval = false) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/flywheel/actions${forceEval ? '?eval=true' : ''}`);
      if (res.ok) {
        const json = await res.json();
        setActions(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchActions(); }, []);

  const handleAction = async (actionId: string, status: 'APPROVED' | 'DISMISSED') => {
    try {
      const res = await fetch('/api/admin/flywheel/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, status: status === 'APPROVED' ? 'EXECUTED' : 'DISMISSED' })
      });
      if (res.ok) {
        setActions(prev => prev.filter(a => a.id !== actionId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
        
        {/* Header */}
        <div className="flex flex-col items-center justify-center mb-12 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-xl" style={{ background: brand.gradient }}>
            <IconZap size={32} style={{ color: '#fff' }} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Founder OS</h1>
          <p className="text-slate-500 mt-2 text-lg">Your intelligent daily action feed.</p>
          <div className="mt-6">
            <button 
              onClick={() => fetchActions(true)} 
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 font-medium text-sm shadow-sm hover:bg-slate-50 transition-colors"
            >
              <IconRefresh size={15} /> Run Engine Sync
            </button>
          </div>
        </div>

        {/* Action Feed */}
        <div className="space-y-6">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin text-amber-600"><IconRefresh size={32} /></div>
            </div>
          ) : actions.length === 0 ? (
            <div className="text-center py-20 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <IconCheck size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Inbox Zero</h3>
              <p className="text-slate-500">No pending actions. The engine is idle.</p>
            </div>
          ) : (
            actions.map((action) => (
              <div key={action.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row">
                  {/* Context Side */}
                  <div className="p-6 flex-1 border-b sm:border-b-0 sm:border-r border-slate-100">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`px-2 py-1 text-xs font-bold uppercase tracking-wider rounded bg-slate-100 ${
                        action.type === 'UPSELL' ? 'text-blue-600' :
                        action.type === 'RISK' ? 'text-red-600' :
                        action.type === 'REFERRAL' ? 'text-emerald-600' : 'text-slate-600'
                      }`}>
                        {action.type}
                      </span>
                      {Number(action.revenuePotential) > 0 && (
                        <span className="text-sm font-bold text-emerald-600">
                          +₹{Number(action.revenuePotential).toLocaleString()} Potential
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-xl font-bold text-slate-900 mb-2">{action.title}</h3>
                    <p className="text-slate-600 mb-4">{action.reason}</p>
                    
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                        <IconUser size={18} className="text-slate-500" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-slate-900">{action.contact?.name || 'Unknown Contact'}</div>
                        <div className="text-xs text-slate-500">{action.contact?.email}</div>
                      </div>
                    </div>
                  </div>

                  {/* Action Side */}
                  <div className="p-6 sm:w-64 flex flex-col justify-center items-center bg-slate-50 gap-3">
                    <div className="text-center mb-2">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Suggested Action</div>
                      <div className="text-sm font-bold text-slate-700">{action.suggestedAction.replace(/_/g, ' ')}</div>
                    </div>
                    <button
                      onClick={() => handleAction(action.id, 'APPROVED')}
                      className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-sm transition-transform active:scale-95 flex justify-center items-center gap-2"
                    >
                      <IconCheck size={18} /> Approve & Execute
                    </button>
                    <button
                      onClick={() => handleAction(action.id, 'DISMISSED')}
                      className="w-full py-2 px-4 bg-transparent hover:bg-slate-200 text-slate-500 font-semibold rounded-xl transition-colors flex justify-center items-center gap-2"
                    >
                      <IconX size={16} /> Dismiss
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
