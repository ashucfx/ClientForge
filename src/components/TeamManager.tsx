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
    <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6">
      
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Workspace Security</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Team &amp; Access Control</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Manage administrator credentials, portal tenancy access, and workspace roles.</p>
        </div>
        <button
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#0A0B0D] via-[#1C1812] to-[#B8935B] text-white text-xs sm:text-sm font-bold shadow-md shadow-[#B8935B]/20 hover:opacity-95 transition-all active:scale-95 flex items-center justify-center gap-1.5 self-start sm:self-auto"
          onClick={() => setShowInvite(true)}
        >
          <span>+</span>
          <span>Invite Admin</span>
        </button>
      </div>

      {/* ── Mobile Team Card View (< md screens) ── */}
      <div className="block md:hidden space-y-3">
        {loading ? (
          <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">Loading administrators...</div>
        ) : admins.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">No administrators found.</div>
        ) : (
          admins.map((admin) => {
            const initial = admin.email.charAt(0).toUpperCase() || 'A';
            return (
              <div key={admin.id} className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
                {/* Header: Avatar + Email + Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0A0B0D] to-[#B8935B] text-white flex items-center justify-center font-extrabold text-sm shadow-xs shrink-0">
                      {initial}
                    </div>
                    <div className="min-w-0">
                      <div className="font-extrabold text-sm text-slate-900 truncate max-w-[180px]">{admin.email}</div>
                      <div className="text-[11px] text-slate-400">
                        {admin.lastLoginAt ? `Last login: ${format(new Date(admin.lastLoginAt), 'dd MMM yyyy')}` : 'Never logged in'}
                      </div>
                    </div>
                  </div>
                  <button 
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border transition-all ${
                      admin.isActive 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                    onClick={() => handleUpdate(admin.id, { isActive: !admin.isActive })}
                    title="Click to toggle status"
                  >
                    {admin.isActive ? 'Active' : 'Inactive'}
                  </button>
                </div>

                {/* Role Selector & Portal Access */}
                <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-500">Role:</span>
                    <select 
                      className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800"
                      value={admin.role}
                      onChange={(e) => handleUpdate(admin.id, { role: e.target.value })}
                    >
                      <option value="SUPER_ADMIN">Super Admin</option>
                      <option value="EDITOR">Editor</option>
                      <option value="VIEWER">Viewer</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="font-semibold text-slate-500">Tenants:</span>
                    {admin.role === 'SUPER_ADMIN' ? (
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold">All Portals</span>
                    ) : (
                      <div className="flex gap-2">
                        {PORTALS.map(portal => {
                          const access = admin.brandAccess ?? [];
                          const checked = access.includes(portal.id);
                          return (
                            <label key={portal.id} className="inline-flex items-center gap-1 text-[11px] font-semibold cursor-pointer">
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
                                className="rounded text-[#B8935B]"
                              />
                              <span style={{ color: checked ? portal.color : '#94a3b8' }}>{portal.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold text-center transition-all"
                    onClick={() => handleResetPassword(admin.id, admin.email)}
                  >
                    Reset Password
                  </button>
                  <button
                    className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold text-center transition-all border border-rose-200"
                    onClick={() => handleDelete(admin.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Desktop Team Table View (>= md screens) ── */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3.5">Administrator</th>
                <th className="px-4 py-3.5">Role</th>
                <th className="px-4 py-3.5">Portal Access</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5">Last Login</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">Loading administrators...</td>
                </tr>
              ) : (
                admins.map((admin) => {
                  const initial = admin.email.charAt(0).toUpperCase() || 'A';
                  return (
                    <tr key={admin.id} className="hover:bg-[#FBF8F3]/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0A0B0D] to-[#B8935B] text-white flex items-center justify-center font-extrabold text-xs shadow-xs shrink-0">
                            {initial}
                          </div>
                          <span className="font-bold text-slate-900">{admin.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <select 
                          className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none"
                          value={admin.role}
                          onChange={(e) => handleUpdate(admin.id, { role: e.target.value })}
                        >
                          <option value="SUPER_ADMIN">Super Admin</option>
                          <option value="EDITOR">Editor</option>
                          <option value="VIEWER">Viewer</option>
                        </select>
                      </td>
                      <td className="px-4 py-3.5">
                        {admin.role === 'SUPER_ADMIN' ? (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-bold">All portals</span>
                        ) : (
                          <div className="flex items-center gap-3">
                            {PORTALS.map(portal => {
                              const access = admin.brandAccess ?? [];
                              const checked = access.includes(portal.id);
                              return (
                                <label key={portal.id} className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
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
                                    className="rounded text-[#B8935B]"
                                  />
                                  <span style={{ color: checked ? portal.color : '#94a3b8' }}>{portal.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <button 
                          className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold border transition-all ${
                            admin.isActive 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                          }`}
                          onClick={() => handleUpdate(admin.id, { isActive: !admin.isActive })}
                          title="Click to toggle status"
                        >
                          {admin.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap" suppressHydrationWarning>
                        {admin.lastLoginAt ? `${format(new Date(admin.lastLoginAt), 'dd MMM yyyy, HH:mm')}` : 'Never'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
                            onClick={() => handleResetPassword(admin.id, admin.email)}
                          >
                            Reset Password
                          </button>
                          <button
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all border border-rose-200"
                            onClick={() => handleDelete(admin.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Invite Admin Modal ── */}
      {showInvite && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200/90 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-900">Invite New Administrator</h3>
              <button onClick={() => setShowInvite(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
            </div>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Email Address</label>
                <input 
                  type="email" 
                  required 
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8935B]"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="admin@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Temporary Password</label>
                <input 
                  type="password" 
                  required 
                  minLength={8}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8935B]"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Role Permission</label>
                <select 
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#B8935B]"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                >
                  <option value="EDITOR">Editor (Manage clients &amp; invoices)</option>
                  <option value="VIEWER">Viewer (Read-only access)</option>
                  <option value="SUPER_ADMIN">Super Admin (Full system control)</option>
                </select>
              </div>

              {newRole !== 'SUPER_ADMIN' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Assigned Portals</label>
                  <div className="flex gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    {PORTALS.map(portal => (
                      <label key={portal.id} className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newBrandAccess.includes(portal.id)}
                          onChange={() => {
                            setNewBrandAccess(prev => 
                              prev.includes(portal.id) ? prev.filter(b => b !== portal.id) : [...prev, portal.id]
                            );
                          }}
                          className="rounded text-[#B8935B]"
                        />
                        <span style={{ color: portal.color }}>{portal.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2.5 pt-3">
                <button 
                  type="button" 
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all"
                  onClick={() => setShowInvite(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={inviting}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#0A0B0D] via-[#1C1812] to-[#B8935B] text-white text-xs font-bold shadow-md shadow-[#B8935B]/20 hover:opacity-95 transition-all disabled:opacity-50"
                >
                  {inviting ? 'Inviting…' : 'Confirm Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
