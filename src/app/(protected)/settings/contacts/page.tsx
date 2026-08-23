'use client';
import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { useAdmin } from '@/components/AdminProvider';
import { IconTrash, IconCheck } from '@/components/Icons';

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
        if (Array.isArray(d)) setContacts(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const handleCopy = (id: string) => {
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
      <main className="page-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>
              Global Contacts Directory
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
              View all Client IDs, manage contacts, and permanently remove ghost leads.
            </p>
          </div>
          <div>
            <input
              type="text"
              className="input"
              style={{ width: 280, margin: 0, fontSize: 13, padding: '7px 12px' }}
              placeholder="Search by ID, name, email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Loading contacts directory…</div>
          ) : filteredContacts.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              {contacts.length === 0 ? 'No contacts found in database.' : 'No contacts matching your search.'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--muted)' }}>
                  <th style={{ padding: '12px 18px' }}>Client / Contact ID</th>
                  <th style={{ padding: '12px 18px' }}>Contact Details</th>
                  <th style={{ padding: '12px 18px' }}>Company</th>
                  <th style={{ padding: '12px 18px' }}>Status</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map((c, idx) => {
                  const displayId = c.displayId || c.id;
                  const isCopied = copiedId === displayId;
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? '#fff' : '#fafbfc' }}>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            fontFamily: 'monospace',
                            fontSize: 12,
                            fontWeight: 700,
                            color: '#4338ca',
                            background: '#eef2ff',
                            padding: '3px 8px',
                            borderRadius: 6,
                            border: '1px solid #c7d2fe',
                          }}>
                            {displayId}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(displayId)}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              padding: 2,
                              color: isCopied ? '#16a34a' : '#94a3b8',
                              fontSize: 11,
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                            title="Copy Client ID"
                          >
                            {isCopied ? <IconCheck size={13} /> : '📋'}
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text)' }}>{c.name || 'Unnamed'}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                          {c.email || 'No email'} {c.phone ? `· ${c.phone}` : ''}
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
                          {c.deletedAt ? 'Soft-Deleted' : (c.status || 'Active')}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleDelete(c.id, c.name)}
                          className="btn btn-ghost"
                          style={{ padding: '5px 10px', color: '#dc2626', border: '1px solid #fecaca', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}
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
          )}
        </div>
      </main>
    </AppShell>
  );
}
