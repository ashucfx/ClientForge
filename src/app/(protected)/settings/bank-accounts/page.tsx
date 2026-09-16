'use client';
import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { useAdmin } from '@/components/AdminProvider';
import { IconTrash, IconEye, IconRefresh, IconCheck, IconCopy, IconEdit, IconBuilding, IconPlus } from '@/components/Icons';

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

const DEFAULT_FORM = {
  currency: 'USD',
  transferRail: 'ACH',
  accountName: 'Catalyst TPA',
  bankName: '',
  accountNumber: '',
  routingNumber: '',
  routingType: 'ach_routing_number',
  swiftBic: '',
  iban: '',
  sortCode: '',
  country: 'US',
  bankAddress: '',
  isActive: true,
};

const CURRENCY_PRESETS: Record<string, { transferRail: string; routingType: string; bankName?: string; country?: string }> = {
  USD: { transferRail: 'ACH', routingType: 'ach_routing_number', bankName: 'Community Federal Savings Bank', country: 'US' },
  GBP: { transferRail: 'FPS / BACS / CHAPS', routingType: 'Sort_Code', bankName: 'Banking Circle S.A. UK Branch', country: 'GB' },
  EUR: { transferRail: 'SEPA / SEPA Instant', routingType: 'BIC_SWIFT', bankName: 'Banking Circle Germany', country: 'EU' },
  CAD: { transferRail: 'EFT', routingType: 'routing_code', bankName: 'Digital Commerce Bank', country: 'CA' },
  AUD: { transferRail: 'NPP / BECS / Osko', routingType: 'BSB Number', bankName: 'BC Payments Australia Pty Ltd', country: 'AU' },
  DKK: { transferRail: 'DKK Local', routingType: 'BIC_SWIFT', bankName: 'Banking Circle Denmark', country: 'DK' },
  AED: { transferRail: 'FTS', routingType: 'routing_code', country: 'AE' },
  SGD: { transferRail: 'GIRO', routingType: 'routing_code', country: 'SG' },
};

export default function BankAccountsSettingsPage() {
  const { isSuperAdmin } = useAdmin();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<'closed' | 'add' | 'edit' | 'view'>('closed');
  const [formData, setFormData] = useState<any>(DEFAULT_FORM);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadAccounts = () => {
    if (isSuperAdmin) {
      setLoading(true);
      fetch('/api/admin/international-payment-accounts')
        .then(res => res.json())
        .then(data => {
          if (data.accounts) setAccounts(data.accounts);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  };

  useEffect(() => {
    loadAccounts();
  }, [isSuperAdmin]);

  const copyToClipboard = (text: string, key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCurrencyChange = (newCurrency: string) => {
    const preset = CURRENCY_PRESETS[newCurrency];
    setFormData({
      ...formData,
      currency: newCurrency,
      ...(preset ? {
        transferRail: preset.transferRail,
        routingType: preset.routingType,
        ...(modalMode === 'add' && preset.bankName ? { bankName: preset.bankName } : {}),
        ...(preset.country ? { country: preset.country } : {}),
      } : {}),
    });
  };

  const openAddModal = () => {
    setFormData(DEFAULT_FORM);
    setModalMode('add');
    setSelectedId(null);
  };

  const openEditModal = (acc: BankAccount) => {
    setFormData({ ...DEFAULT_FORM, ...acc });
    setSelectedId(acc.id);
    setModalMode('edit');
  };

  const openViewModal = (acc: BankAccount) => {
    setFormData({ ...DEFAULT_FORM, ...acc });
    setModalMode('view');
  };

  const handleDelete = async (id: string, currency: string) => {
    if (!confirm(`Are you sure you want to permanently delete the bank account for ${currency}?`)) return;
    try {
      const res = await fetch(`/api/admin/international-payment-accounts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setAccounts(accounts.filter(a => a.id !== id));
      } else {
        alert('Failed to delete account');
      }
    } catch (e) {
      alert('Error deleting account');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modalMode === 'view') return;
    
    try {
      const url = modalMode === 'edit' && selectedId 
        ? `/api/admin/international-payment-accounts/${selectedId}` 
        : '/api/admin/international-payment-accounts';
      
      const res = await fetch(url, {
        method: modalMode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setModalMode('closed');
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
          <div className="w-12 h-12 rounded-2xl bg-[#FBF8F3] border border-[#EAE2D5] text-[#B8935B] flex items-center justify-center mx-auto mb-4 shadow-xs">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
          <p className="text-sm text-slate-500 mt-1">Only Super Admins can manage Bank Accounts.</p>
        </div>
      </AppShell>
    );
  }

  const activeAccountsCount = accounts.filter(a => a.isActive).length;
  const uniqueCurrenciesCount = new Set(accounts.map(a => a.currency)).size;

  return (
    <AppShell>
      <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 pb-16">
        {/* ── Top Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#B8935B]" />
              <span>Treasury & Settlement</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#FBF8F3] border border-[#EAE2D5] text-[#B8935B] flex items-center justify-center shadow-xs">
                <IconBuilding size={18} />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">International Bank Accounts</h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Configure verified wire receiving accounts for manual Bank Transfer invoices & client portal instructions.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button 
              onClick={openAddModal}
              className="px-4 py-2 rounded-xl bg-[#B8935B] hover:bg-[#9A7540] text-white text-xs sm:text-sm font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <IconPlus size={14} /> <span>Add Bank Account</span>
            </button>
          </div>
        </div>

        {/* ── Metrics Strip ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Configured Accounts</div>
              <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-0.5">{accounts.length}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-600">
              <IconBuilding size={18} />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Active For Transfers</div>
              <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-0.5">{activeAccountsCount}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600">
              <IconCheck size={18} />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-[#B8935B] uppercase tracking-wider">Supported Currencies</div>
              <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-0.5">{uniqueCurrenciesCount}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#FBF8F3] border border-[#EAE2D5] flex items-center justify-center text-[#B8935B]">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </div>
          </div>
        </div>

        {/* ── Content Area ── */}
        {loading ? (
          <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
            <IconRefresh size={22} className="animate-spin mx-auto text-[#B8935B] mb-2.5" />
            <div className="text-sm font-semibold text-slate-700">Loading bank accounts…</div>
            <p className="text-xs text-slate-400 mt-0.5">Fetching wire settlement destination details</p>
          </div>
        ) : accounts.length === 0 ? (
          <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-[#FBF8F3] border border-[#EAE2D5] text-[#B8935B] flex items-center justify-center mx-auto mb-3 shadow-xs">
              <IconBuilding size={22} />
            </div>
            <div className="text-sm font-bold text-slate-900">No Bank Accounts Configured</div>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto mb-5">
              Add verified international banking details for incoming client wire transfers and invoice payment links.
            </p>
            <button
              onClick={openAddModal}
              className="px-4 py-2.5 rounded-xl bg-[#B8935B] hover:bg-[#9A7540] text-white text-xs font-bold transition-all shadow-xs"
            >
              + Add Bank Account
            </button>
          </div>
        ) : (
          <>
            {/* ── Mobile Cards (< md) ── */}
            <div className="block md:hidden space-y-3">
              {accounts.map(acc => {
                const accKey = `acc-${acc.id}`;
                const routKey = `rout-${acc.id}`;
                const accNum = acc.accountNumber || acc.iban || '';
                const routNum = acc.routingNumber || acc.sortCode || '';

                return (
                  <div key={acc.id} className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded-md bg-[#FBF8F3] border border-[#EAE2D5] text-[#B8935B]">
                            {acc.currency}
                          </span>
                          <span className="text-xs font-semibold text-slate-700">{acc.transferRail}</span>
                        </div>
                        <div className="font-bold text-sm text-slate-900 mt-1 truncate">{acc.bankName || 'Unnamed Bank'}</div>
                      </div>

                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase shrink-0 border ${
                        acc.isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {acc.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500 font-medium">Beneficiary:</span>
                        <span className="font-semibold text-slate-800">{acc.accountName}</span>
                      </div>

                      {accNum && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500 font-medium">Account / IBAN:</span>
                          <button
                            type="button"
                            onClick={(e) => copyToClipboard(accNum, accKey, e)}
                            className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200"
                          >
                            <span>{accNum}</span>
                            {copiedKey === accKey ? <IconCheck size={11} className="text-emerald-600" /> : <IconCopy size={11} className="text-slate-400" />}
                          </button>
                        </div>
                      )}

                      {routNum && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500 font-medium">{acc.routingType || 'Routing'}:</span>
                          <button
                            type="button"
                            onClick={(e) => copyToClipboard(routNum, routKey, e)}
                            className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200"
                          >
                            <span>{routNum}</span>
                            {copiedKey === routKey ? <IconCheck size={11} className="text-emerald-600" /> : <IconCopy size={11} className="text-slate-400" />}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                      <button
                        onClick={() => openViewModal(acc)}
                        className="flex-1 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors flex items-center justify-center gap-1"
                      >
                        <IconEye size={12} />
                        <span>View</span>
                      </button>
                      <button
                        onClick={() => openEditModal(acc)}
                        className="flex-1 py-1.5 rounded-xl bg-[#FBF8F3] hover:bg-[#F4EFE6] border border-[#EAE2D5] text-[#B8935B] text-xs font-bold transition-colors flex items-center justify-center gap-1"
                      >
                        <IconEdit size={12} />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(acc.id, acc.currency)}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition-colors flex items-center justify-center gap-1 shrink-0"
                      >
                        <IconTrash size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Desktop Table (>= md) ── */}
            <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="px-5 py-3.5">Currency</th>
                      <th className="px-4 py-3.5">Payment Method</th>
                      <th className="px-4 py-3.5">Bank & Account Details</th>
                      <th className="px-4 py-3.5">Routing Code</th>
                      <th className="px-4 py-3.5 text-center">Status</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {accounts.map(acc => {
                      const accKey = `acc-${acc.id}`;
                      const routKey = `rout-${acc.id}`;
                      const accNum = acc.accountNumber || acc.iban || '';
                      const routNum = acc.routingNumber || acc.sortCode || '';

                      return (
                        <tr key={acc.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-5 py-3.5">
                            <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg bg-[#FBF8F3] border border-[#EAE2D5] text-[#B8935B]">
                              {acc.currency}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-slate-800">
                            {acc.transferRail}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-slate-900">{acc.bankName || 'N/A'}</div>
                            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                              <span>{acc.accountName}</span>
                              {accNum && (
                                <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                  {accNum}
                                  <button
                                    type="button"
                                    onClick={(e) => copyToClipboard(accNum, accKey, e)}
                                    className="text-slate-400 hover:text-slate-600 ml-0.5"
                                    title="Copy account number"
                                  >
                                    {copiedKey === accKey ? <IconCheck size={11} className="text-emerald-600" /> : <IconCopy size={11} />}
                                  </button>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            {routNum ? (
                              <div>
                                <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                  {routNum}
                                  <button
                                    type="button"
                                    onClick={(e) => copyToClipboard(routNum, routKey, e)}
                                    className="text-slate-400 hover:text-slate-600 ml-0.5"
                                    title="Copy routing code"
                                  >
                                    {copiedKey === routKey ? <IconCheck size={11} className="text-emerald-600" /> : <IconCopy size={11} />}
                                  </button>
                                </span>
                                <div className="text-[10px] text-slate-400 mt-0.5">{acc.routingType || 'routing_code'}</div>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                              acc.isActive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              {acc.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openViewModal(acc)}
                                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
                                title="View details"
                              >
                                <IconEye size={13} />
                              </button>
                              <button
                                onClick={() => openEditModal(acc)}
                                className="p-1.5 rounded-lg bg-[#FBF8F3] hover:bg-[#F4EFE6] border border-[#EAE2D5] text-[#B8935B] transition-colors"
                                title="Edit account"
                              >
                                <IconEdit size={13} />
                              </button>
                              <button
                                onClick={() => handleDelete(acc.id, acc.currency)}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors"
                                title="Delete account"
                              >
                                <IconTrash size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── Modal ── */}
        {modalMode !== 'closed' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
              <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  {modalMode === 'add' ? 'Add Bank Account' : modalMode === 'edit' ? 'Edit Bank Account' : 'View Bank Account Details'}
                </h2>
                <button
                  type="button"
                  onClick={() => setModalMode('closed')}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Currency</label>
                    <select
                      disabled={modalMode === 'view'}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#B8935B]/30 focus:border-[#B8935B]"
                      value={formData.currency}
                      onChange={e => handleCurrencyChange(e.target.value)}
                    >
                      <option value="USD">USD - US Dollar</option>
                      <option value="GBP">GBP - British Pound</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="CAD">CAD - Canadian Dollar</option>
                      <option value="AUD">AUD - Australian Dollar</option>
                      <option value="DKK">DKK - Danish Krone</option>
                      <option value="AED">AED - UAE Dirham</option>
                      <option value="SGD">SGD - Singapore Dollar</option>
                      <option value="CNY">CNY - Chinese Yuan</option>
                      <option value="CHF">CHF - Swiss Franc</option>
                      <option value="SEK">SEK - Swedish Krona</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Payment Rail</label>
                    <input
                      readOnly={modalMode === 'view'}
                      type="text"
                      list="payment-method-presets"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#B8935B]/30 focus:border-[#B8935B]"
                      placeholder="e.g. ACH, FPS / BACS"
                      value={formData.transferRail}
                      onChange={e => setFormData({ ...formData, transferRail: e.target.value })}
                    />
                    <datalist id="payment-method-presets">
                      <option value="ACH" />
                      <option value="FPS / BACS / CHAPS" />
                      <option value="SEPA / SEPA Instant" />
                      <option value="EFT" />
                      <option value="NPP / BECS / Osko" />
                      <option value="DKK Local" />
                      <option value="FTS" />
                      <option value="GIRO" />
                      <option value="SWIFT" />
                    </datalist>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Account Holder Name</label>
                  <input
                    readOnly={modalMode === 'view'}
                    required
                    type="text"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#B8935B]/30 focus:border-[#B8935B]"
                    placeholder="e.g. Catalyst TPA"
                    value={formData.accountName}
                    onChange={e => setFormData({...formData, accountName: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Bank Name</label>
                  <input
                    readOnly={modalMode === 'view'}
                    required
                    type="text"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#B8935B]/30 focus:border-[#B8935B]"
                    placeholder="e.g. Community Federal Savings Bank"
                    value={formData.bankName}
                    onChange={e => setFormData({...formData, bankName: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Account Number / IBAN</label>
                    <input
                      readOnly={modalMode === 'view'}
                      type="text"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#B8935B]/30 focus:border-[#B8935B]"
                      value={formData.accountNumber}
                      onChange={e => setFormData({...formData, accountNumber: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Routing Code</label>
                    <input
                      readOnly={modalMode === 'view'}
                      type="text"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#B8935B]/30 focus:border-[#B8935B]"
                      value={formData.routingNumber}
                      onChange={e => setFormData({...formData, routingNumber: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Routing Type</label>
                    <input
                      readOnly={modalMode === 'view'}
                      type="text"
                      list="routing-type-presets"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#B8935B]/30 focus:border-[#B8935B]"
                      placeholder="ach_routing_number"
                      value={formData.routingType}
                      onChange={e => setFormData({...formData, routingType: e.target.value})}
                    />
                    <datalist id="routing-type-presets">
                      <option value="ach_routing_number" />
                      <option value="Sort_Code" />
                      <option value="BIC_SWIFT" />
                      <option value="routing_code" />
                      <option value="BSB Number" />
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">SWIFT / BIC (Optional)</label>
                    <input
                      readOnly={modalMode === 'view'}
                      type="text"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#B8935B]/30 focus:border-[#B8935B]"
                      value={formData.swiftBic}
                      onChange={e => setFormData({...formData, swiftBic: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Bank Address</label>
                  <input
                    readOnly={modalMode === 'view'}
                    type="text"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#B8935B]/30 focus:border-[#B8935B]"
                    placeholder="e.g. 68 King William Street, London..."
                    value={formData.bankAddress}
                    onChange={e => setFormData({...formData, bankAddress: e.target.value})}
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    disabled={modalMode === 'view'}
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={e => setFormData({...formData, isActive: e.target.checked})}
                    className="w-4 h-4 rounded text-[#B8935B] focus:ring-[#B8935B]"
                  />
                  <label htmlFor="isActive" className="text-xs font-semibold text-slate-800 cursor-pointer">
                    Active for client wire transfers
                  </label>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                  {modalMode === 'view' ? (
                    <button
                      type="button"
                      onClick={() => setModalMode('closed')}
                      className="px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-xs font-semibold hover:bg-slate-100"
                    >
                      Close
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setModalMode('closed')}
                        className="px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-xs font-semibold hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-[#B8935B] hover:bg-[#9A7540] text-white text-xs font-bold shadow-xs transition-colors"
                      >
                        {modalMode === 'edit' ? 'Update Account' : 'Save Account'}
                      </button>
                    </>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
