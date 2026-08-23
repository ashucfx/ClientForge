'use client';
import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { useAdmin } from '@/components/AdminProvider';
import { IconTrash, IconCheck, IconCopy, IconSearch, IconUser, IconRefresh } from '@/components/Icons';

export default function ContactsAdminPage() {
  const { isSuperAdmin } = useAdmin();
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadContacts = () => {
    setLoading(true);
    fetch('/api/admin/contacts/list')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          d.sort((a, b) => {
            const idA = a.displayId || a.id || '';
            const idB = b.displayId || b.id || '';
            const matchA = idA.match(/(\d+)$/);
            const matchB = idB.match(/(\d+)$/);
            if (matchA && matchB) {
              return parseInt(matchB[1], 10) - parseInt(matchA[1], 10);
            }
            return idB.localeCompare(idA);
          });
          setContacts(d);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const handleCopy = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete the contact "${name}"? This will remove all associated orphaned records.`)) return;
    try {
      const res = await fetch(`/api/admin/contacts/${id}/delete`, { method: 'DELETE' });
      if (res.ok) {
        setContacts(prev => prev.filter(c => c.id !== id));
      } else {
        const err = await res.json();
        alert('Failed to delete: ' + (err.error || 'Unknown error'));
      }
    } catch (e: any) {
      alert('Failed to delete: ' + e.message);
    }
  };

  const filteredContacts = contacts.filter(c => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      (c.id && c.id.toLowerCase().includes(q)) ||
      (c.displayId && c.displayId.toLowerCase().includes(q)) ||
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      (c.companyName && c.companyName.toLowerCase().includes(q))
    );
  });

  if (!isSuperAdmin) {
    return (
      <AppShell>
        <div className="w-full max-w-4xl mx-auto px-4 py-24 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
          <p className="text-sm text-slate-500 mt-1">Only Super Admins can manage Global Contacts.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="page-body" style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconUser size={20} />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>
                  Global Contacts Directory
                </h1>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted)', lineHeight: 1.4 }}>
                  Manage client records, view unique Client IDs, and permanently remove ghost leads.
                </p>
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', maxWidth: 360 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                className="input"
                style={{ width: '100%', margin: 0, fontSize: 13, padding: '9px 12px 9px 34px', borderRadius: 10 }}
                placeholder="Search by ID, name, email, phone…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none', display: 'flex' }}>
                <IconSearch size={15} />
              </span>
            </div>
            <button
              onClick={loadContacts}
              disabled={loading}
              className="btn btn-ghost"
              style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
              title="Refresh"
            >
              <IconRefresh size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>

        {/* Directory Card */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 14, boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              <IconRefresh size={20} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px', display: 'block', color: 'var(--brand)' }} />
              Loading contacts directory…
            </div>
          ) : filteredContacts.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              {contacts.length === 0 ? 'No contacts found in the database.' : 'No contacts matching your search.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 640 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--muted)' }}>
                    <th style={{ padding: '12px 18px', width: 220 }}>Client / Contact ID</th>
                    <th style={{ padding: '12px 18px' }}>Client Info</th>
                    <th style={{ padding: '12px 18px' }}>Company</th>
                    <th style={{ padding: '12px 18px', width: 120 }}>Status</th>
                    <th style={{ padding: '12px 18px', textAlign: 'right', width: 100 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.map((c, idx) => {
                    const displayId = c.displayId || c.id;
                    const isCopied = copiedId === displayId;
                    return (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? '#fff' : '#fafbfc', transition: 'background .15s' }}>
                        <td style={{ padding: '14px 18px' }}>
                          <button
                            type="button"
                            onClick={(e) => handleCopy(displayId, e)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '4px 8px',
                              background: isCopied ? '#f0fdf4' : '#f1f5f9',
                              border: `1px solid ${isCopied ? '#bbf7d0' : '#e2e8f0'}`,
                              borderRadius: 8,
                              cursor: 'pointer',
                              transition: 'all .15s ease',
                              maxWidth: '100%',
                            }}
                            title="Click to copy ID"
                          >
                            <span style={{
                              fontFamily: 'ui-monospace, monospace',
                              fontSize: 12,
                              fontWeight: 700,
                              color: isCopied ? '#15803d' : '#334155',
                              letterSpacing: '.2px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {displayId}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', color: isCopied ? '#16a34a' : '#64748b' }}>
                              {isCopied ? <IconCheck size={13} strokeWidth={2.5} /> : <IconCopy size={13} />}
                            </span>
                          </button>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text)' }}>{c.name || 'Unnamed'}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {c.email && <span>{c.email}</span>}
                            {c.phone && <span>· {c.phone}</span>}
                          </div>
                        </td>
                        <td style={{ padding: '14px 18px', color: 'var(--text)' }}>{c.companyName || '—'}</td>
                        <td style={{ padding: '14px 18px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 12,
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: c.deletedAt ? '#fee2e2' : '#f1f5f9',
                            color: c.deletedAt ? '#b91c1c' : '#475569',
                          }}>
                            {c.deletedAt ? 'Deleted' : (c.status || 'Active')}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <button
                            onClick={() => handleDelete(c.id, c.name)}
                            className="btn btn-ghost"
                            style={{ padding: '5px 10px', color: '#dc2626', border: '1px solid #fecaca', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 8 }}
                            title="Permanently remove"
                          >
                            <IconTrash size={13} /> Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
