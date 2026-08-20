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
      <div className="max-w-4xl mx-auto px-3.5 sm:px-6 lg:px-8 py-6 sm:py-12">
        
        {/* Header */}
        <div className="flex flex-col items-center justify-center mb-8 sm:mb-12 text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mb-3 sm:mb-4 shadow-xl" style={{ background: brand.gradient }}>
            <IconZap size={28} style={{ color: '#fff' }} />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Founder OS</h1>
          <p className="text-slate-500 mt-1 sm:mt-2 text-sm sm:text-base">Intelligent growth triggers and high-leverage client actions.</p>
          <div className="mt-4 sm:mt-6">
            <button 
              onClick={() => fetchActions(true)} 
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs sm:text-sm shadow-xs hover:bg-slate-50 transition-all active:scale-95"
            >
              <IconRefresh size={14} className={loading ? 'animate-spin' : ''} /> Run Engine Sync
            </button>
          </div>
        </div>

        {/* Action Feed */}
        <div className="space-y-4 sm:space-y-6">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin text-amber-600"><IconRefresh size={32} /></div>
            </div>
          ) : actions.length === 0 ? (
            <div className="text-center py-16 sm:py-20 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 border border-emerald-100">
                <IconCheck size={24} />
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900">Inbox Zero</h3>
              <p className="text-slate-500 text-xs sm:text-sm mt-0.5">All automation triggers are up to date. The engine is idle.</p>
            </div>
          ) : (
            actions.map((action) => (
              <div key={action.id} className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row">
                  {/* Context Side */}
                  <div className="p-4 sm:p-6 flex-1 border-b sm:border-b-0 sm:border-r border-slate-100">
                    <div className="flex items-center gap-2 mb-2 sm:mb-3 flex-wrap">
                      <span className={`px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider rounded-md ${
                        action.type === 'UPSELL' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        action.type === 'RISK' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        action.type === 'REFERRAL' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {action.type}
                      </span>
                      {Number(action.revenuePotential) > 0 && (
                        <span className="text-xs sm:text-sm font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                          +₹{Number(action.revenuePotential).toLocaleString()} Potential
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mb-1.5">{action.title}</h3>
                    <p className="text-xs sm:text-sm text-slate-600 mb-4 leading-relaxed">{action.reason}</p>
                    
                    <div className="flex items-center gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200/60">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0A0B0D] to-[#B8935B] text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {action.contact?.name ? action.contact.name[0].toUpperCase() : 'C'}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs sm:text-sm text-slate-900 truncate">{action.contact?.name || 'Unknown Contact'}</div>
                        <div className="text-[11px] text-slate-500 truncate">{action.contact?.email}</div>
                      </div>
                    </div>
                  </div>

                  {/* Action Side */}
                  <div className="p-4 sm:p-6 sm:w-64 flex flex-col justify-center items-center bg-[#FDFBF7] gap-2.5">
                    <div className="text-center mb-1 w-full">
                      <div className="text-[10px] font-extrabold text-[#7A5B2E] uppercase tracking-wider mb-0.5">Suggested Action</div>
                      <div className="text-xs font-extrabold text-slate-800 truncate">{action.suggestedAction.replace(/_/g, ' ')}</div>
                    </div>
                    <button
                      onClick={() => handleAction(action.id, 'APPROVED')}
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-[#0A0B0D] via-[#1C1812] to-[#B8935B] hover:opacity-95 text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-xs transition-all active:scale-98 flex justify-center items-center gap-1.5"
                    >
                      <IconCheck size={16} /> Approve &amp; Execute
                    </button>
                    <button
                      onClick={() => handleAction(action.id, 'DISMISSED')}
                      className="w-full py-2 px-4 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all flex justify-center items-center gap-1.5 active:scale-98"
                    >
                      <IconX size={14} /> Dismiss
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
