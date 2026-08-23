'use client';
import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { useAdmin } from '@/components/AdminProvider';

type BankAccount = {
  id: string;
  currency: string;
  transferRail: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
  routingNumber: string;
  routingType: string;
  sortCode: string;
  iban: string;
  swiftBic: string;
  bankAddress: string;
  isActive: boolean;
};

export default function BankAccountsSettingsPage() {
  const { isSuperAdmin } = useAdmin();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    currency: 'USD',
    transferRail: 'ACH',
    accountName: '',
    bankName: '',
    accountNumber: '',
    routingNumber: '',
    routingType: 'ach_routing_number',
    swiftBic: '',
    iban: '',
    sortCode: '',
    country: 'US',
    bankAddress: '',
  });

  const loadAccounts = () => {
    if (isSuperAdmin) {
      setLoading(true);
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
  };

  useEffect(() => {
    loadAccounts();
  }, [isSuperAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/international-payment-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setIsModalOpen(false);
        loadAccounts();
      } else {
        alert('Failed to save account');
      }
    } catch (err) {
      alert('Error saving account');
    }
  };

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
      <div className="w-full max-w-6xl mx-auto px-4 py-8 relative">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">International Bank Accounts</h1>
            <p className="text-sm text-slate-500 mt-1">Configure receiving accounts for manual Bank Transfer invoices.</p>
          </div>
          <button 
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors"
            onClick={() => setIsModalOpen(true)}
          >
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
                      {/* Delete functionality could be added here later */}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* MODAL */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
                <h2 className="text-xl font-bold text-slate-900">Add Bank Account</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Currency</label>
                    <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})}>
                      <option value="USD">USD - US Dollar</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="GBP">GBP - British Pound</option>
                      <option value="AUD">AUD - Australian Dollar</option>
                      <option value="CAD">CAD - Canadian Dollar</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Transfer Rail</label>
                    <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" value={formData.transferRail} onChange={e => setFormData({...formData, transferRail: e.target.value})}>
                      <option value="ACH">ACH (Local US)</option>
                      <option value="SEPA">SEPA (Local Europe)</option>
                      <option value="BACS">BACS / FPS (Local UK)</option>
                      <option value="SWIFT">SWIFT (Global)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Account Name</label>
                  <input required type="text" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="e.g. Ripple Nexus Inc." value={formData.accountName} onChange={e => setFormData({...formData, accountName: e.target.value})} />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Bank Name</label>
                  <input required type="text" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="e.g. Community Federal Savings Bank" value={formData.bankName} onChange={e => setFormData({...formData, bankName: e.target.value})} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Account Number / IBAN</label>
                    <input type="text" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" value={formData.accountNumber} onChange={e => setFormData({...formData, accountNumber: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Routing Code</label>
                      <input type="text" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" value={formData.routingNumber} onChange={e => setFormData({...formData, routingNumber: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Routing Type</label>
                      <input type="text" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="e.g. ach_routing_number" value={formData.routingType} onChange={e => setFormData({...formData, routingType: e.target.value})} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">SWIFT / BIC (Optional)</label>
                    <input type="text" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" value={formData.swiftBic} onChange={e => setFormData({...formData, swiftBic: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Bank Address</label>
                    <input type="text" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="e.g. 5 Penn Plaza..." value={formData.bankAddress} onChange={e => setFormData({...formData, bankAddress: e.target.value})} />
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors">
                    Save Account
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
