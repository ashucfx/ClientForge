'use client';
import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { useAdmin } from '@/components/AdminProvider';
import { format } from 'date-fns';

type BankAccount = {
  id: string;
  currency: string;
  transferRail: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
  routingNumber: string;
  sortCode: string;
  iban: string;
  swiftBic: string;
  isActive: boolean;
};

export default function BankAccountsSettingsPage() {
  const { isSuperAdmin } = useAdmin();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isSuperAdmin) {
      fetch('/api/admin/international-payment-accounts')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setAccounts(data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [isSuperAdmin]);

  if (!isSuperAdmin) {
    return (
      <AppShell>
        <div className="w-full max-w-4xl mx-auto px-4 py-24 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
          <p className="text-sm text-slate-500 mt-1">Only Super Admins can manage Bank Accounts.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="w-full max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">International Bank Accounts</h1>
            <p className="text-sm text-slate-500 mt-1">Configure receiving accounts for manual Bank Transfer invoices.</p>
          </div>
          <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg shadow-sm" onClick={() => alert('Add form to be implemented via modal/new page')}>
            + Add Account
          </button>
        </div>

        {loading ? (
          <div className="text-slate-500 py-10 text-center">Loading accounts...</div>
        ) : accounts.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
            <div className="text-3xl mb-3">🏦</div>
            <h3 className="text-base font-bold text-slate-800">No Bank Accounts Configured</h3>
            <p className="text-sm text-slate-500 mt-1 mb-4">Add your first bank account to enable International Wire Transfers.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="px-4 py-3">Currency</th>
                  <th className="px-4 py-3">Rail</th>
                  <th className="px-4 py-3">Bank Details</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {accounts.map(acc => (
                  <tr key={acc.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-4 font-bold text-slate-800">{acc.currency}</td>
                    <td className="px-4 py-4 text-slate-600">{acc.transferRail}</td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-900">{acc.bankName}</div>
                      <div className="text-xs text-slate-500">{acc.accountName} • {acc.accountNumber || acc.iban}</div>
                    </td>
                    <td className="px-4 py-4">
                      {acc.isActive ? (
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase rounded-md">Active</span>
                      ) : (
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded-md">Inactive</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button className="text-indigo-600 hover:text-indigo-900 text-xs font-bold">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
