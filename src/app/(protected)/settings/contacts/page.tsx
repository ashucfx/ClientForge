'use client';
import { useState, useEffect } from 'react';
import { RippleNexusShell } from '@/components/shells/RippleNexusShell';
import { IconTrash, IconUser } from '@/components/Icons';

export default function ContactsAdminPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadContacts = () => {
    setLoading(true);
    fetch('/api/admin/contacts/list')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) setContacts(d);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete the contact "${name}"? This will delete all associated records.`)) return;
    try {
      const res = await fetch(`/api/admin/contacts/${id}/delete`, { method: 'DELETE' });
      if (res.ok) {
        setContacts(contacts.filter(c => c.id !== id));
      } else {
        const err = await res.json();
        alert('Failed to delete: ' + err.error);
      }
    } catch (e: any) {
      alert('Failed to delete: ' + e.message);
    }
  };

  return (
    <RippleNexusShell>
      <main className="page-body">
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>
            Global Contacts Directory
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--muted)' }}>
            Manage and clean up all global contacts, including deleted leads.
          </p>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>Loading contacts...</div>
          ) : contacts.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>No contacts found.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-3)', borderBottom: '1px solid var(--border)', textAlign: 'left', fontSize: 12, color: 'var(--muted)' }}>
                  <th style={{ padding: '12px 20px' }}>Contact Details</th>
                  <th style={{ padding: '12px 20px' }}>Company</th>
                  <th style={{ padding: '12px 20px' }}>Status</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.email || 'No email'} · {c.phone || 'No phone'}</div>
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: 13, color: 'var(--text)' }}>{c.companyName || '—'}</td>
                    <td style={{ padding: '16px 20px' }}>
                      <span className="badge" style={{ background: 'var(--surface-3)', color: 'var(--muted)' }}>{c.status}</span>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <button onClick={() => handleDelete(c.id, c.name)} className="btn btn-ghost" style={{ padding: '6px 12px', color: '#ef4444', border: '1px solid #fee2e2' }}>
                        <IconTrash /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </RippleNexusShell>
  );
}
