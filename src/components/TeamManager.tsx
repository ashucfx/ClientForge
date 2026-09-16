'use client';

import { useEffect, useState, useCallback } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { IconPlus, IconTrash, IconUser } from '@/components/Icons';

type AdminUser = {
  id: string;
  email: string;
  role: 'SUPER_ADMIN' | 'EDITOR' | 'VIEWER';
  brandAccess: string[];
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

type SessionLog = {
  id: string;
  sessionId?: string;
  adminId: string;
  email: string;
  role: 'SUPER_ADMIN' | 'EDITOR' | 'VIEWER';
  isActive: boolean;
  ip: string;
  userAgent: string;
  createdAt: string;
  isRevoked?: boolean;
  isBlocked?: boolean;
  isCurrent?: boolean;
  status?: 'ACTIVE' | 'REVOKED' | 'BLOCKED';
};

const PORTALS: { id: string; label: string; color: string }[] = [
  { id: 'catalyst', label: 'Catalyst', color: 'var(--brand)' },
];

function parseClientDevice(userAgent: string) {
  if (!userAgent || userAgent === 'unknown') return { device: 'Unknown Device', browser: 'Browser', isMobile: false };
  const ua = userAgent.toLowerCase();
  
  let device = 'Desktop';
  let isMobile = false;
  if (ua.includes('iphone')) {
    device = 'iPhone';
    isMobile = true;
  } else if (ua.includes('ipad')) {
    device = 'iPad';
    isMobile = true;
  } else if (ua.includes('android')) {
    device = ua.includes('mobile') ? 'Android Mobile' : 'Android Tablet';
    isMobile = true;
  } else if (ua.includes('macintosh') || ua.includes('mac os')) {
    device = 'macOS';
  } else if (ua.includes('windows')) {
    device = 'Windows PC';
  } else if (ua.includes('linux')) {
    device = 'Linux';
  }

  let browser = 'Browser';
  if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('chrome/') || ua.includes('crios/')) browser = 'Chrome';
  else if (ua.includes('safari/') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('firefox/') || ua.includes('fxios/')) browser = 'Firefox';

  return { device, browser, isMobile };
}

export function TeamManager() {
  const [activeTab, setActiveTab] = useState<'members' | 'sessions'>('members');
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(false);
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

  const [blockedIps, setBlockedIps] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch('/api/admin/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
        setBlockedIps(data.blockedIps || []);
      }
    } catch {
      // Ignore
    }
    setSessionsLoading(false);
  }, []);

  const handleRevokeSession = async (session: SessionLog) => {
    if (!confirm(`Revoke and terminate session for ${session.email} on ${session.ip}? That device will be logged out immediately.`)) return;
    setActionLoading(session.id);
    try {
      const res = await fetch('/api/admin/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REVOKE',
          sessionId: session.sessionId ?? session.id,
          logId: session.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revoke session');
      fetchSessions();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error revoking session');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBlockIp = async (ip: string) => {
    if (!ip || ip === 'unknown') return alert('Cannot block an unknown IP.');
    if (!confirm(`Block IP address ${ip}? This will terminate all active sessions originating from this IP and block all future logins from it.`)) return;
    setActionLoading(ip);
    try {
      const res = await fetch('/api/admin/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'BLOCK_IP',
          ip,
          reason: 'Suspicious / unrecognised session blocked by admin',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to block IP');
      fetchSessions();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error blocking IP');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnblockIp = async (ip: string) => {
    if (!confirm(`Unblock IP address ${ip}?`)) return;
    setActionLoading(ip);
    try {
      const res = await fetch('/api/admin/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UNBLOCK_IP',
          ip,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to unblock IP');
      fetchSessions();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error unblocking IP');
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearAllSessions = async () => {
    if (!confirm('Are you sure you want to clear all administrator login session logs?')) return;
    try {
      const res = await fetch('/api/admin/sessions', { method: 'DELETE' });
      if (res.ok) {
        setSessions([]);
      } else {
        alert('Failed to clear session logs.');
      }
    } catch {
      alert('Error clearing session logs.');
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm('Delete this session audit log entry?')) return;
    try {
      const res = await fetch(`/api/admin/sessions?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== id));
      } else {
        alert('Failed to delete session log.');
      }
    } catch {
      alert('Error deleting session log.');
    }
  };

  useEffect(() => {
    fetchAdmins();
    fetchSessions();
  }, [fetchAdmins, fetchSessions]);

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

  const superAdminsCount = admins.filter(a => a.role === 'SUPER_ADMIN').length;
  const activeAdminsCount = admins.filter(a => a.isActive).length;

  return (
    <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 pb-16">
      
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#B8935B]" />
            <span>Workspace Security & Governance</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FBF8F3] border border-[#EAE2D5] text-[#B8935B] flex items-center justify-center shadow-xs">
              <IconUser size={18} />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Team &amp; Access Control</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Manage administrator credentials, portal tenancy access, and audit login sessions.</p>
        </div>
        {activeTab === 'members' && (
          <button
            className="flex-shrink-0 px-4 py-2 rounded-xl bg-[#B8935B] hover:bg-[#9A7540] text-white text-xs sm:text-sm font-bold transition-all shadow-xs self-start sm:self-auto flex items-center gap-1.5"
            onClick={() => setShowInvite(true)}
          >
            <IconPlus size={14} />
            <span>Invite Admin</span>
          </button>
        )}
      </div>

      {/* ── Metrics Strip ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Administrators</div>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-0.5">{admins.length}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-600">
            <IconUser size={18} />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-[#B8935B] uppercase tracking-wider">Super Admins</div>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-0.5">{superAdminsCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#FBF8F3] border border-[#EAE2D5] flex items-center justify-center text-[#B8935B]">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Active Authentications</div>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-0.5">{activeAdminsCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'members'
              ? 'bg-[#B8935B] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <IconUser size={14} />
          <span>Team Members</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
            activeTab === 'members' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {admins.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('sessions')}
          className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'sessions'
              ? 'bg-[#B8935B] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>Session Logs</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
            activeTab === 'sessions' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {sessions.length}
          </span>
        </button>
      </div>

      {activeTab === 'members' ? (
        <>
          {/* ── Mobile Team Card View (< md screens) ── */}
          <div className="block md:hidden space-y-3">
        {loading ? (
          <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200 text-sm">Loading administrators...</div>
        ) : admins.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200 text-sm">No administrators found.</div>
        ) : (
          admins.map((admin) => {
            return (
              <div key={admin.id} className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
                {/* Header: Email + Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-slate-900 truncate">{admin.email}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {admin.lastLoginAt ? `Last login: ${format(new Date(admin.lastLoginAt), 'dd MMM yyyy')}` : 'Never logged in'}
                    </div>
                  </div>
                  <button 
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors shrink-0 ${
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
                <div className="space-y-2.5 pt-2.5 border-t border-slate-100 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-500">Role:</span>
                    <select 
                      className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800"
                      value={admin.role}
                      onChange={(e) => handleUpdate(admin.id, { role: e.target.value })}
                    >
                      <option value="SUPER_ADMIN">Super Admin</option>
                      <option value="EDITOR">Editor</option>
                      <option value="VIEWER">Viewer</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                    <span className="font-medium text-slate-500">Tenants:</span>
                    {admin.role === 'SUPER_ADMIN' ? (
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-medium">All Portals</span>
                    ) : (
                      <div className="flex gap-3 flex-wrap">
                        {PORTALS.map(portal => {
                          const access = admin.brandAccess ?? [];
                          const checked = access.includes(portal.id);
                          return (
                            <label key={portal.id} className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer">
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
                <div className="flex items-center gap-2 pt-2.5 border-t border-slate-100">
                  <button
                    className="flex-1 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold text-center transition-colors flex items-center justify-center gap-1.5"
                    onClick={() => handleResetPassword(admin.id, admin.email)}
                  >
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    <span>Reset Password</span>
                  </button>
                  <button
                    className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold text-center transition-colors border border-rose-200 flex items-center justify-center gap-1"
                    onClick={() => handleDelete(admin.id)}
                  >
                    <IconTrash size={12} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Desktop Team Table View (>= md screens) ── */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3">Administrator</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Portal Access</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3">Last Login</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">Loading administrators...</td>
                </tr>
              ) : (
                admins.map((admin) => {
                  return (
                    <tr key={admin.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-slate-900">{admin.email}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <select 
                          className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#B8935B]"
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
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-medium">All portals</span>
                        ) : (
                          <div className="flex items-center gap-3">
                            {PORTALS.map(portal => {
                              const access = admin.brandAccess ?? [];
                              const checked = access.includes(portal.id);
                              return (
                                <label key={portal.id} className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer">
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
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors ${
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
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5"
                            onClick={() => handleResetPassword(admin.id, admin.email)}
                          >
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                            <span>Reset Password</span>
                          </button>
                          <button
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium transition-colors border border-rose-200 flex items-center gap-1"
                            onClick={() => handleDelete(admin.id)}
                          >
                            <IconTrash size={12} />
                            <span>Delete</span>
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
      </>
      ) : (
        /* ── Session Logs View ── */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900">Administrator Login Sessions</h2>
                {blockedIps.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                    {blockedIps.length} IP{blockedIps.length > 1 ? 's' : ''} Blocked
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Audit log of authentications with device classification, IP address, and role. Revoke unrecognized sessions or block suspicious IPs.</p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {sessions.length > 0 && (
                <button
                  onClick={handleClearAllSessions}
                  className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <IconTrash size={13} />
                  <span>Clear All Logs</span>
                </button>
              )}
              <button
                onClick={fetchSessions}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Administrator</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Device & Client</th>
                  <th className="py-3 px-4">Login Date & Time</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {sessionsLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">Loading session logs...</td>
                  </tr>
                ) : sessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">No session login logs recorded yet.</td>
                  </tr>
                ) : (
                  sessions.map(session => {
                    const client = parseClientDevice(session.userAgent);
                    return (
                      <tr key={session.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">{session.email}</td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            {session.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                              client.isMobile 
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}>
                              {client.isMobile ? (
                                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                                  <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="3" strokeLinecap="round" />
                                </svg>
                              ) : (
                                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                                  <line x1="8" y1="21" x2="16" y2="21" />
                                  <line x1="12" y1="17" x2="12" y2="21" />
                                </svg>
                              )}
                              <span>{client.device}</span>
                            </span>
                            <span className="text-[11px] text-slate-400">·</span>
                            <span className="text-[11px] text-slate-500 font-medium">{client.browser}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-mono">
                          <div>{format(new Date(session.createdAt), 'PPP p')}</div>
                          <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                            {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{session.ip}</span>
                            {session.isBlocked && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                                BLOCKED
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {session.isCurrent ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              This Device (Current)
                            </span>
                          ) : session.isRevoked ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <span className="w-2 h-2 rounded-full bg-rose-500" />
                              Revoked (Logged Out)
                            </span>
                          ) : session.isBlocked ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              Terminated (Blocked IP)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {!session.isCurrent && !session.isRevoked && (
                              <button
                                onClick={() => handleRevokeSession(session)}
                                disabled={actionLoading === session.id}
                                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors shadow-2xs disabled:opacity-50"
                                title="Immediately revoke token and log out this session"
                              >
                                {actionLoading === session.id ? '…' : 'Revoke Session'}
                              </button>
                            )}
                            {session.ip && session.ip !== 'unknown' && (
                              session.isBlocked ? (
                                <button
                                  onClick={() => handleUnblockIp(session.ip)}
                                  disabled={actionLoading === session.ip}
                                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors shadow-2xs disabled:opacity-50"
                                  title="Unblock this IP address"
                                >
                                  {actionLoading === session.ip ? '…' : 'Unblock IP'}
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleBlockIp(session.ip)}
                                  disabled={actionLoading === session.ip}
                                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors shadow-2xs disabled:opacity-50"
                                  title="Block this IP address and terminate all sessions from it"
                                >
                                  {actionLoading === session.ip ? '…' : 'Block IP'}
                                </button>
                              )
                            )}
                            <button
                              onClick={() => handleDeleteSession(session.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete log record"
                            >
                              <IconTrash size={13} />
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
      )}

      {/* ── Invite Admin Modal ── */}
      {showInvite && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl p-5 sm:p-7 max-w-md w-full border border-slate-200 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base sm:text-lg font-bold text-slate-900">Invite New Administrator</h3>
              <button onClick={() => setShowInvite(false)} className="text-slate-400 hover:text-slate-600 text-lg font-semibold">✕</button>
            </div>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Email Address</label>
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
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Temporary Password</label>
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
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Role Permission</label>
                <select 
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#B8935B]"
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
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Assigned Portals</label>
                  <div className="flex gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    {PORTALS.map(portal => (
                      <label key={portal.id} className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
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

              <div className="flex gap-2.5 pt-2">
                <button 
                  type="button" 
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                  onClick={() => setShowInvite(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={inviting}
                  className="flex-1 py-2.5 rounded-xl bg-[#B8935B] hover:bg-[#9A7540] text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
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
