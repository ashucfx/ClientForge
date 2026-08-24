'use client';
// src/app/(protected)/settings/page.tsx
// Admin System Settings — visible to SUPER_ADMIN only
// Controls client-selective package upgrade offers and custom pricing overrides.

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import { useAdmin } from '@/components/AdminProvider';

export default function SettingsPage() {
  const { isSuperAdmin } = useAdmin();

  if (!isSuperAdmin) {
    return (
      <AppShell>
        <div className="w-full max-w-4xl mx-auto px-4 py-24 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
          <p className="text-sm text-slate-500 mt-1">Executive Connect pricing is only accessible to Super Admins.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 pb-16">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Configuration Hub</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Executive Connect Pricing
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Configure system-wide overrides for Executive Connect local currency rates.
          </p>
        </div>

        <ExecutiveConnectPricingSection />
      </div>
    </AppShell>
  );
}


function ExecutiveConnectPricingSection() {
  const [jsonText, setJsonText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ msg: string; isError?: boolean } | null>(null);

  useEffect(() => {
    fetch('/api/admin/settings/executive-connect')
      .then(res => res.json())
      .then(data => {
        if (data.map) {
          setJsonText(JSON.stringify(data.map, null, 2));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const saveMap = async () => {
    setSaving(true);
    setStatusMsg(null);
    let parsed = {};
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setStatusMsg({ msg: 'Invalid JSON format. Please check for syntax errors.', isError: true });
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/settings/executive-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      if (res.ok) {
        setStatusMsg({ msg: 'Executive Connect pricing map saved successfully!' });
      } else {
        throw new Error();
      }
    } catch {
      setStatusMsg({ msg: 'Failed to save pricing map.', isError: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
      <div className="px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm font-bold">💎</span>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Executive Connect Global Pricing Map</h2>
            <p className="text-xs text-slate-500 mt-0.5">Define fixed prices for each currency. Used for a-la-carte checkouts.</p>
          </div>
        </div>
      </div>
      <div className="p-4 sm:p-6 space-y-4">
        {loading ? (
          <div className="text-sm text-slate-400">Loading...</div>
        ) : (
          <>
            <textarea
              className="w-full h-64 p-3 rounded-lg border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
            />
            {statusMsg && (
              <div className={`p-3 rounded-xl text-xs font-semibold border ${statusMsg.isError ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                {statusMsg.msg}
              </div>
            )}
            <button
              onClick={saveMap}
              disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Pricing Map'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
