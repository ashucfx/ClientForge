'use client';

import { useEffect, useState, useCallback } from 'react';

import { formatDistanceToNow, format } from 'date-fns';

type AdminUser = {
  id: string;
  email: string;
  role: 'SUPER_ADMIN' | 'EDITOR' | 'VIEWER';
  brandAccess: string[];
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

const PORTALS: { id: string; label: string; color: string }[] = [
  { id: 'catalyst',     label: 'Catalyst',     color: 'var(--brand)' },
  { id: 'ripple_nexus', label: 'Ripple Nexus', color: '#7C5CFF' },
];

export function TeamManager() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite Modal State
  const [showInvite, setShowInvite] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'SUPER_ADMIN' | 'EDITOR' | 'VIEWER'>('EDITOR');
  const [newBrandAccess, setNewBrandAccess] = useState<string[]>(['catalyst']);
  const [inviting, setInviting] = useState(false);

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admins');
      if (res.status === 403) throw new Error('You do not have permission to view the team.');
      if (!res.ok) throw new Error('Failed to load team data.');
      const data = await res.json();
      setAdmins(data.admins || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newBrandAccess.length === 0) {
      alert('Select at least one portal for this admin.');
      return;
    }
    setInviting(true);
    try {
      const res = await fetch('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, password: newPassword, role: newRole, brandAccess: newBrandAccess }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to invite user');

      setShowInvite(false);
      setNewEmail('');
      setNewPassword('');
      setNewRole('EDITOR');
      setNewBrandAccess(['catalyst']);
      fetchAdmins();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error inviting user');
    }
    setInviting(false);
  };

  const handleResetPassword = async (id: string, email: string) => {
    const password = prompt(`Set a new password for ${email} (min 8 characters):`);
    if (password === null) return;
    if (password.length < 8) {
      alert('Password must be at least 8 characters.');
      return;
    }
    try {
      const res = await fetch(`/api/admins/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reset password');
      }
      alert(`Password updated for ${email}.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Password reset failed');
    }
  };

  const handleUpdate = async (id: string, updates: { role?: string; isActive?: boolean; brandAccess?: string[] }) => {
    try {
      const res = await fetch(`/api/admins/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update');
      }
      fetchAdmins();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this admin? This action cannot be undone.')) return;
    try {
      const res = await fetch(`/api/admins/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
      fetchAdmins();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  if (error) {
    return (
      <div className="page-header" style={{ paddingBottom: 24 }}>
        <h1 className="page-title" style={{ color: 'var(--error)' }}>Access Denied</h1>
        <p className="page-subtitle">{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-header" style={{ paddingBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Team & Access</h1>
            <p className="page-subtitle">Manage workspace administrators and roles</p>
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => setShowInvite(true)}>
            + Invite Admin
          </button>
        </div>
      </div>

      <div className="page-body" style={{ paddingTop: 0 }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="table-scroll-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Portal Access</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>Loading...</td>
                  </tr>
                ) : (
                  admins.map((admin) => (
                    <tr key={admin.id}>
                      <td style={{ fontWeight: 600 }}>{admin.email}</td>
                      <td>
                        <select 
                          className="input" 
                          style={{ padding: '4px 8px', width: 'auto', minWidth: 140 }}
                          value={admin.role}
                          onChange={(e) => handleUpdate(admin.id, { role: e.target.value })}
                        >
                          <option value="SUPER_ADMIN">Super Admin</option>
                          <option value="EDITOR">Editor (No Team Access)</option>
                          <option value="VIEWER">Viewer (No Team Access)</option>
                        </select>
                      </td>
                      <td>
                        {admin.role === 'SUPER_ADMIN' ? (
                          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>All portals</span>
                        ) : (
                          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {PORTALS.map(portal => {
                              const access = admin.brandAccess ?? [];
                              const checked = access.includes(portal.id);
                              return (
                                <label key={portal.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer', color: checked ? portal.color : 'var(--text-tertiary)', fontWeight: checked ? 700 : 500 }}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      const next = checked ? access.filter(b => b !== portal.id) : [...access, portal.id];
                                      if (next.length === 0) {
                                        alert('An admin must keep access to at least one portal.');
                                        return;
                                      }
                                      handleUpdate(admin.id, { brandAccess: next });
                                    }}
                                  />
                                  {portal.label}
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td>
                        <button 
                          className={`badge ${admin.isActive ? 'badge-paid' : 'badge-cancelled'}`}
                          style={{ cursor: 'pointer', border: 'none' }}
                          onClick={() => handleUpdate(admin.id, { isActive: !admin.isActive })}
                          title="Click to toggle status"
                        >
                          {admin.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td style={{ color: 'var(--text-tertiary)', fontSize: 13 }} suppressHydrationWarning>
                        {admin.lastLoginAt ? `${format(new Date(admin.lastLoginAt), 'dd MMM yyyy, HH:mm')} (Local)` : 'Never'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleResetPassword(admin.id, admin.email)}
                          >
                            Reset Password
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(admin.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showInvite && (
        <div className="modal-backdrop" onClick={() => setShowInvite(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ fontSize: 17, fontWeight: 700 }}>Invite Admin User</div>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowInvite(false)}>✕</button>
            </div>
            <form onSubmit={handleInvite}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="field">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Email Address</label>
                  <input className="input" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required />
                </div>
                <div className="field">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Temporary Password</label>
                  <input className="input" type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                </div>
                <div className="field">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Role</label>
                  <select className="input" value={newRole} onChange={e => setNewRole(e.target.value as any)}>
                    <option value="SUPER_ADMIN">Super Admin (Full Access - Can manage team)</option>
                    <option value="EDITOR">Editor (Can create invoices, cannot access Team page)</option>
                    <option value="VIEWER">Viewer (Read-only access, cannot access Team page)</option>
                  </select>
                </div>
                {newRole !== 'SUPER_ADMIN' && (
                  <div className="field">
                    <label style={{ fontSize: 12, fontWeight: 700 }}>Portal Access</label>
                    <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                      {PORTALS.map(portal => {
                        const checked = newBrandAccess.includes(portal.id);
                        return (
                          <label key={portal.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: checked ? portal.color : 'var(--text-secondary)', fontWeight: checked ? 700 : 500 }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setNewBrandAccess(prev =>
                                  checked ? prev.filter(b => b !== portal.id) : [...prev, portal.id]
                                )
                              }
                            />
                            {portal.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowInvite(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={inviting}>
                  {inviting ? 'Inviting...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
