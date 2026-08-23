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
  accountName: 'Ripple Nexus',
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
  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);
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

  const copyToClipboard = (text: string, key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSyncPresets = async () => {
    if (!confirm('This will load all verified Razorpay accounts (USD, GBP, EUR, CAD, AUD, DKK) configured for Ripple Nexus into your database. Continue?')) return;
    setSeeding(true);
    try {
      const res = await fetch('/api/admin/international-payment-accounts/seed', { method: 'POST' });
      if (res.ok) {
        setSeedSuccess(true);
        setTimeout(() => setSeedSuccess(false), 3000);
        loadAccounts();
      } else {
        alert('Failed to sync preset accounts');
      }
    } catch {
      alert('Error syncing preset accounts');
    } finally {
      setSeeding(false);
    }
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
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
          <p className="text-sm text-slate-500 mt-1">Only Super Admins can manage Bank Accounts.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="page-body" style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconBuilding size={20} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>
                International Bank Accounts
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted)', lineHeight: 1.4 }}>
                Configure receiving wire accounts for manual Bank Transfer invoices & client portal instructions.
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleSyncPresets}
              disabled={seeding}
              className="btn btn-ghost"
              style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4338ca', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {seedSuccess ? (
                <><IconCheck size={14} /> Synced Razorpay Accounts!</>
              ) : seeding ? (
                <><IconRefresh size={14} style={{ animation: 'spin 1s linear infinite' }} /> Syncing…</>
              ) : (
                <>⚡ Auto-Sync Razorpay Accounts</>
              )}
            </button>
            <button 
              onClick={openAddModal}
              className="btn btn-primary"
              style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <IconPlus size={14} /> Add Account
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--muted)', fontSize: 13, borderRadius: 14 }}>
            <IconRefresh size={20} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px', display: 'block', color: 'var(--brand)' }} />
            Loading accounts…
          </div>
        ) : accounts.length === 0 ? (
          <div className="card" style={{ padding: 48, textAlign: 'center', borderRadius: 14, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🏦</div>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>No Bank Accounts Configured</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--muted)' }}>Click below to automatically import your verified Razorpay bank details.</p>
            <button
              onClick={handleSyncPresets}
              className="btn btn-primary"
              style={{ padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700 }}
            >
              ⚡ Import Razorpay Accounts
            </button>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 14, boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' }}>
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 680 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--muted)' }}>
                    <th style={{ padding: '12px 18px', width: 90 }}>Currency</th>
                    <th style={{ padding: '12px 18px' }}>Payment Method</th>
                    <th style={{ padding: '12px 18px' }}>Bank & Account Details</th>
                    <th style={{ padding: '12px 18px' }}>Routing Code</th>
                    <th style={{ padding: '12px 18px', width: 90 }}>Status</th>
                    <th style={{ padding: '12px 18px', textAlign: 'right', width: 140 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((acc, idx) => {
                    const accKey = `acc-${acc.id}`;
                    const routKey = `rout-${acc.id}`;
                    const accNum = acc.accountNumber || acc.iban || '';
                    const routNum = acc.routingNumber || acc.sortCode || '';
                    return (
                      <tr key={acc.id} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? '#fff' : '#fafbfc' }}>
                        <td style={{ padding: '14px 18px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            background: '#f1f5f9',
                            borderRadius: 6,
                            fontSize: 12,
                            fontFamily: 'ui-monospace, monospace',
                            fontWeight: 800,
                            color: 'var(--text)',
                          }}>
                            {acc.currency}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--text)' }}>
                          {acc.transferRail}
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text)' }}>{acc.bankName || 'N/A'}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span>{acc.accountName}</span>
                            {accNum && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f8fafc', padding: '1px 6px', borderRadius: 4, border: '1px solid #e2e8f0', fontFamily: 'ui-monospace, monospace' }}>
                                {accNum}
                                <button
                                  type="button"
                                  onClick={(e) => copyToClipboard(accNum, accKey, e)}
                                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 1, color: copiedKey === accKey ? '#16a34a' : '#94a3b8', display: 'flex' }}
                                  title="Copy account number"
                                >
                                  {copiedKey === accKey ? <IconCheck size={11} strokeWidth={2.5} /> : <IconCopy size={11} />}
                                </button>
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          {routNum ? (
                            <div>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f8fafc', padding: '1px 6px', borderRadius: 4, border: '1px solid #e2e8f0', fontFamily: 'ui-monospace, monospace', fontWeight: 700, fontSize: 12 }}>
                                {routNum}
                                <button
                                  type="button"
                                  onClick={(e) => copyToClipboard(routNum, routKey, e)}
                                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 1, color: copiedKey === routKey ? '#16a34a' : '#94a3b8', display: 'flex' }}
                                  title="Copy routing code"
                                >
                                  {copiedKey === routKey ? <IconCheck size={11} strokeWidth={2.5} /> : <IconCopy size={11} />}
                                </button>
                              </span>
                              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{acc.routingType || 'routing_code'}</div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--muted)' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 12,
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: acc.isActive ? '#dcfce7' : '#f1f5f9',
                            color: acc.isActive ? '#15803d' : '#64748b',
                          }}>
                            {acc.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
                            <button
                              onClick={() => openViewModal(acc)}
                              className="btn btn-ghost"
                              style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)' }}
                              title="View details"
                            >
                              <IconEye size={13} />
                            </button>
                            <button
                              onClick={() => openEditModal(acc)}
                              className="btn btn-ghost"
                              style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4338ca' }}
                              title="Edit account"
                            >
                              <IconEdit size={13} />
                            </button>
                            <button
                              onClick={() => handleDelete(acc.id, acc.currency)}
                              className="btn btn-ghost"
                              style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #fee2e2', color: '#dc2626' }}
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
        )}

        {/* Modal */}
        {modalMode !== 'closed' && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 16, backdropFilter: 'blur(2px)' }}>
            <div className="card" style={{ width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto', padding: 0, borderRadius: 16, boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border)', background: '#fff' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
                  {modalMode === 'add' ? 'Add Bank Account' : modalMode === 'edit' ? 'Edit Bank Account' : 'View Bank Account Details'}
                </h2>
                <button type="button" onClick={() => setModalMode('closed')} className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 16, lineHeight: 1 }}>✕</button>
              </div>

              <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: 14, marginBottom: 14 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Currency</label>
                    <select
                      disabled={modalMode === 'view'}
                      className="input"
                      style={{ margin: 0, width: '100%', fontWeight: 600 }}
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
                    <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Payment Method / Rail</label>
                    <input
                      readOnly={modalMode === 'view'}
                      type="text"
                      list="payment-method-presets"
                      className="input"
                      style={{ margin: 0, width: '100%', fontWeight: 600 }}
                      placeholder="e.g. ACH, FPS / BACS / CHAPS"
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

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Account Holder Name</label>
                  <input readOnly={modalMode === 'view'} required type="text" className="input" style={{ margin: 0, width: '100%' }} placeholder="e.g. Ripple Nexus" value={formData.accountName} onChange={e => setFormData({...formData, accountName: e.target.value})} />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Bank Name</label>
                  <input readOnly={modalMode === 'view'} required type="text" className="input" style={{ margin: 0, width: '100%' }} placeholder="e.g. Banking Circle S.A." value={formData.bankName} onChange={e => setFormData({...formData, bankName: e.target.value})} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: 14, marginBottom: 14 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Account Number / IBAN</label>
                    <input readOnly={modalMode === 'view'} type="text" className="input" style={{ margin: 0, width: '100%', fontFamily: 'ui-monospace, monospace' }} value={formData.accountNumber} onChange={e => setFormData({...formData, accountNumber: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Routing Code</label>
                    <input readOnly={modalMode === 'view'} type="text" className="input" style={{ margin: 0, width: '100%', fontFamily: 'ui-monospace, monospace' }} value={formData.routingNumber} onChange={e => setFormData({...formData, routingNumber: e.target.value})} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: 14, marginBottom: 14 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Routing Type</label>
                    <input
                      readOnly={modalMode === 'view'}
                      type="text"
                      list="routing-type-presets"
                      className="input"
                      style={{ margin: 0, width: '100%' }}
                      placeholder="Sort_Code"
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
                    <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>SWIFT / BIC (Optional)</label>
                    <input readOnly={modalMode === 'view'} type="text" className="input" style={{ margin: 0, width: '100%', fontFamily: 'ui-monospace, monospace' }} value={formData.swiftBic} onChange={e => setFormData({...formData, swiftBic: e.target.value})} />
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Bank Address</label>
                  <input readOnly={modalMode === 'view'} type="text" className="input" style={{ margin: 0, width: '100%' }} placeholder="e.g. 68 King William Street, London..." value={formData.bankAddress} onChange={e => setFormData({...formData, bankAddress: e.target.value})} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                  <input disabled={modalMode === 'view'} type="checkbox" id="isActive" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} style={{ width: 16, height: 16 }} />
                  <label htmlFor="isActive" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>Active for client wire transfers</label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  {modalMode === 'view' ? (
                    <button type="button" onClick={() => setModalMode('closed')} className="btn btn-ghost" style={{ padding: '8px 16px', borderRadius: 8 }}>Close</button>
                  ) : (
                    <>
                      <button type="button" onClick={() => setModalMode('closed')} className="btn btn-ghost" style={{ padding: '8px 16px', borderRadius: 8 }}>Cancel</button>
                      <button type="submit" className="btn btn-primary" style={{ padding: '8px 18px', borderRadius: 8 }}>
                        {modalMode === 'edit' ? 'Update Account' : 'Save Account'}
                      </button>
                    </>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
