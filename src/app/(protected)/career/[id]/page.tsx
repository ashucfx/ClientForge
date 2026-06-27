'use client';
// src/app/(protected)/career/[id]/page.tsx

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PACKAGE_LABELS, SERVICE_LABELS, STATUS_LABELS } from '@/lib/career/types';
import type { CareerStatus, CareerPackage, CareerServiceSlug, EmailTrigger } from '@/lib/career/types';
import { TRIGGER_LABELS } from '@/lib/career/triggerLabels';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormSubmission {
  id: string; formType: string; version: number;
  submittedAt: string; formData: Record<string, unknown>;
}
interface Deliverable {
  id: string; label: string; fileUrl: string;
  fileType: string; mimeType: string; sizeBytes: number;
  fileCategory: string; createdAt: string;
}
interface EmailLog {
  id: string; trigger: string; status: string; sentAt: string; resendId: string | null;
}
interface ActivityLog {
  id: string; action: string; performedBy: string;
  createdAt: string; metadata: Record<string, unknown> | null;
}
interface RevisionItem {
  id: string; note: string; fileLabel?: string; status: string;
  requestedBy: string; adminNote?: string; createdAt: string;
}
interface ClientDetail {
  id: string; name: string; email: string; phone: string | null;
  packageType: CareerPackage | null; status: CareerStatus;
  lifecycleStatus: string;
  amountPaid: number; currency: string; notes: string | null;
  createdAt: string; lastLoginAt: string | null; invoiceId: string | null;
  slaDeadline: string | null; slaStatus: string | null;
  forms: FormSubmission[];
  deliverables: Deliverable[];
  emailLogs: EmailLog[];
  activityLogs: ActivityLog[];
  services: { slug: string; name: string }[];
  Feedback?: { id: string; npsScore: number; rating: number; submittedAt: string } | null;
  Review?: { id: string; content: string; permissionToUse: boolean; submittedAt: string } | null;
  invoice?: { invoiceNumber: string; totalPayable: number; currency: string; status: string } | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: CareerStatus[] = [
  'NOT_STARTED','SUBMITTED','UNDER_PROCESS','DRAFT_SENT','REVISION_REQUESTED','COMPLETED',
];
const STATUS_STYLES: Record<CareerStatus, { bg: string; text: string; dot: string }> = {
  NOT_STARTED:        { bg: 'bg-slate-100',   text: 'text-slate-600',  dot: 'bg-slate-400'   },
  SUBMITTED:          { bg: 'bg-[#F0EAE0]',    text: 'text-[#9A7540]',   dot: 'bg-[#B8935B]'    },
  UNDER_PROCESS:      { bg: 'bg-amber-100',   text: 'text-amber-700',  dot: 'bg-amber-500'   },
  DRAFT_SENT:         { bg: 'bg-purple-100',  text: 'text-purple-700', dot: 'bg-purple-500'  },
  REVISION_REQUESTED: { bg: 'bg-orange-100',  text: 'text-orange-700', dot: 'bg-orange-500'  },
  COMPLETED:          { bg: 'bg-emerald-100', text: 'text-emerald-700',dot: 'bg-emerald-500' },
};

// LINKEDIN_DRAFT is NOT in this list — Draft Ready auto-upgrades to the LinkedIn template
// when admin picks a LinkedIn file type in the document picker. No separate manual trigger needed.
const EMAIL_TRIGGERS: { value: EmailTrigger; label: string; desc: string }[] = [
  { value: 'WELCOME',           label: 'Welcome Email',           desc: 'Sends a new magic link + onboarding steps' },
  { value: 'FORM_CONFIRM',      label: 'Form Confirmation',       desc: 'Confirms form was received' },
  { value: 'DRAFT_READY',       label: 'Draft Ready',             desc: 'Notifies client their draft is available for review' },
  { value: 'REVISED_DRAFT',     label: 'Revised Draft Ready',     desc: 'Updated draft after revision is ready' },
  { value: 'REVISION',          label: 'Revision Update',         desc: 'Informs client revision is in progress or denied' },
  { value: 'FINAL_DELIVERY',    label: 'Final Delivery',          desc: 'Sends all uploaded final files to client' },
  { value: 'LINKEDIN_SECURITY', label: 'LinkedIn Security Steps', desc: 'Account security instructions for LinkedIn' },
];
const FILE_TYPES = [
  { value: 'resume',                   label: 'Resume' },
  { value: 'cover_letter',             label: 'Cover Letter' },
  { value: 'linkedin_banner',          label: 'LinkedIn Banner' },
  { value: 'linkedin_profile_picture', label: 'LinkedIn Profile Picture' },
  { value: 'portfolio',                label: 'Portfolio Website' },
  { value: 'other',                    label: 'Other' },
];
const FORM_TYPE_LABELS: Record<string, string> = {
  // Legacy DB names
  resume:            'Career Profile Strategy Brief',
  linkedin:          'LinkedIn Profile Optimisation Brief',
  cover_letter:      'Career Profile Strategy Brief',
  // Canonical new names
  career_profile:    'Career Profile Strategy Brief',
  linkedin_profile:  'LinkedIn Profile Optimisation Brief',
  portfolio_website: 'Portfolio Website Development Brief',
};
const ACTION_LABELS: Record<string, string> = {
  client_created: 'Client created',
  status_changed: 'Status updated',
  file_uploaded: 'File uploaded',
  form_submitted: 'Form submitted',
  email_sent_manual: 'Email sent (manual)',
};

type Tab = 'overview' | 'forms' | 'files' | 'emails' | 'activity' | 'revisions' | 'comments' | 'invoices';

// ── Utilities ─────────────────────────────────────────────────────────────────

function getPackageTier(slugs: string[]): 'resume' | 'resume_cl' | 'booster' | 'premium' | 'other' {
  if (slugs.includes('PREMIUM_PLUS') || slugs.includes('PORTFOLIO')) return 'premium';
  if (slugs.includes('FULL_PACKAGE') || (slugs.includes('RESUME') && slugs.includes('COVER_LETTER') && slugs.includes('LINKEDIN'))) return 'booster';
  if (slugs.includes('RESUME') && slugs.includes('COVER_LETTER')) return 'resume_cl';
  if (slugs.includes('RESUME')) return 'resume';
  return 'other';
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return fmt(dateStr);
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CareerClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showEdit,    setShowEdit]    = useState(false);
  const [showDelete,  setShowDelete]  = useState(false);
  const [welcomeSignal, setWelcomeSignal] = useState(0);

  const triggerWelcome = () => {
    setActiveTab('overview');
    setWelcomeSignal(n => n + 1);
  };
  // OTP delete flow: 'idle' | 'requesting' | 'confirm' | 'deleting' | 'done'
  const [deleteStep,  setDeleteStep]  = useState<'idle' | 'requesting' | 'confirm' | 'deleting' | 'done'>('idle');
  const [otpInput,    setOtpInput]    = useState('');
  const [otpError,    setOtpError]    = useState('');

  const reload = useCallback(async () => {
    const res = await fetch(`/api/career/admin/clients/${id}`);
    const data = await res.json() as { client: ClientDetail };
    setClient(data.client);
    setLoading(false);
  }, [id]);

  useEffect(() => { void reload(); }, [reload]);

  if (loading) return <PageSkeleton />;
  if (!client) return (
    <div className="p-8 text-center">
      <p className="text-slate-500">Client not found.</p>
      <Link href="/career" className="mt-3 inline-block text-[#B8935B] text-sm hover:underline">← Back to Career Booster Services</Link>
    </div>
  );

  const s = STATUS_STYLES[client.status];

  return (
    <div className="p-5 md:p-7 max-w-5xl mx-auto space-y-5">

      {/* Breadcrumb + action buttons */}
      <div className="flex items-center justify-between gap-3">
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/career" className="text-slate-400 hover:text-[#B8935B] transition-colors">Career Booster Services</Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-700 font-medium truncate max-w-[200px]">{client.name}</span>
        </nav>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => setShowEdit(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
          <button onClick={() => { setShowDelete(true); setDeleteStep('idle'); setOtpInput(''); setOtpError(''); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-all">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
            Delete
          </button>
        </div>
      </div>

      {client.lifecycleStatus === 'ARCHIVED' && (
        <div className="bg-slate-100 border border-slate-300 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
          <svg className="text-slate-400 mb-2" width="32" height="32" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
          <h2 className="text-lg font-bold text-slate-800">This client is archived</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-md">
            Their portal access has been safely revoked and they are hidden from the active dashboard.
          </p>
          <button
            onClick={async () => {
              if (!confirm('Are you sure you want to reopen this client? This will regenerate their portal access token and set their status to Under Process.')) return;
              await fetch(`/api/career/admin/clients/${client.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lifecycleStatus: 'ACTIVE' })
              });
              void reload();
            }}
            className="mt-4 px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 transition-colors"
          >
            Reopen Client
          </button>
        </div>
      )}

      {/* Hero card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-[#B8935B] via-[#B8935B] to-emerald-400" />
        <div className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            {/* Left: identity */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#B8935B] flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                {client.name[0]?.toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-slate-900">{client.name}</h1>
                  {client.slaDeadline && (
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${
                      client.status === 'COMPLETED' ? 'bg-slate-100 text-slate-600 border border-slate-200' :
                      new Date(client.slaDeadline).getTime() < Date.now() ? 'bg-red-100 text-red-700 border border-red-200' :
                      new Date(client.slaDeadline).getTime() < Date.now() + 86400000 ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                      'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    }`}>
                      {client.status === 'COMPLETED' ? 'FULFILLED' :
                       new Date(client.slaDeadline).getTime() < Date.now() ? 'SLA BREACHED' :
                       new Date(client.slaDeadline).getTime() < Date.now() + 86400000 ? 'DUE SOON' : 'ON TRACK'}
                    </span>
                  )}
                </div>
                <p className="text-slate-500 text-sm">{client.email}</p>
                {client.phone && <p className="text-slate-400 text-xs mt-0.5">{client.phone}</p>}
              </div>
            </div>
            {/* Right: badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 bg-[#FBF8F3] text-[#9A7540] text-xs font-bold rounded-full border border-[#E8DDD0] uppercase tracking-wide">
                {client.services?.length > 0
                  ? (() => {
                      const slugs = client.services.map(s => s.slug);
                      const hasCareerBooster = slugs.includes('FULL_PACKAGE') || ['RESUME', 'COVER_LETTER', 'LINKEDIN'].every(s => slugs.includes(s));
                      if (slugs.includes('PREMIUM_PLUS') || (hasCareerBooster && slugs.includes('PORTFOLIO'))) {
                        return 'Premium Plus Package';
                      }
                      if (hasCareerBooster) {
                        return 'Career Booster Package';
                      }
                      return client.services.map(s => SERVICE_LABELS[s.slug as CareerServiceSlug] ?? s.name).join(', ');
                    })()
                  : client.packageType ? PACKAGE_LABELS[client.packageType] : 'Career Services'}
              </span>
              <span className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full ${s.bg} ${s.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                {STATUS_LABELS[client.status]}
              </span>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Amount Paid',  value: `${client.currency} ${client.amountPaid.toLocaleString()}` },
              { label: 'SLA Deadline', value: client.status === 'COMPLETED' ? 'Fulfilled' : client.slaDeadline ? new Date(client.slaDeadline).toLocaleDateString() : 'None' },
              { label: 'Forms',        value: `${client.forms.length} submitted` },
              { label: 'Files',        value: `${client.deliverables.length} / 10 uploaded` },
              { label: 'Last Login',   value: client.lastLoginAt ? fmt(client.lastLoginAt, true) : 'Never' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-xs text-slate-400 font-medium mb-0.5">{label}</p>
                <p className="text-sm font-bold text-slate-800">{value}</p>
              </div>
            ))}
          </div>

          {client.notes && (
            <div className="mt-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              <span className="font-semibold">Note: </span>{client.notes}
            </div>
          )}

          {/* Portal activation banner — only when never logged in AND no welcome email sent */}
          {!client.lastLoginAt && !client.emailLogs.some(l => l.trigger === 'WELCOME') && (() => {
            const slugs = client.services?.map(s => s.slug) ?? [];
            const tier = getPackageTier(slugs);
            const formsCopy = tier === 'premium' ? 'Resume, LinkedIn, and Portfolio forms'
              : tier === 'booster' ? 'Resume and LinkedIn Profile forms'
              : tier === 'resume_cl' ? 'Resume & Cover Letter forms'
              : tier === 'resume' ? 'Resume Intake Form'
              : 'intake forms';
            return (
              <div className="mt-4 flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-lg flex-shrink-0">🔑</span>
                  <div>
                    <p className="text-sm font-bold text-amber-900">Portal not yet activated</p>
                    <p className="text-xs text-amber-700">
                      Send the Welcome Email so <strong>{client.name.split(' ')[0]}</strong> can submit their {formsCopy} to get started.
                    </p>
                  </div>
                </div>
                <button
                  onClick={triggerWelcome}
                  className="flex-shrink-0 px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 transition-colors">
                  Send Welcome →
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
        {(['overview','forms','files','emails','activity','revisions','comments','invoices'] as Tab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-shrink-0 px-4 py-1.5 text-sm font-semibold rounded-lg capitalize transition-all ${
              activeTab === tab
                ? 'bg-white shadow text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
            }`}>
            {tab}
            {tab === 'forms'    && client.forms.length        > 0 && <CountBadge n={client.forms.length} />}
            {tab === 'files'    && client.deliverables.length > 0 && <CountBadge n={client.deliverables.length} />}
            {tab === 'emails'   && client.emailLogs.length    > 0 && <CountBadge n={client.emailLogs.length} />}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {activeTab === 'overview' && (
        <OverviewTab client={client} onUpdated={reload} welcomeSignal={welcomeSignal} />
      )}

      {/* ── FORMS ── */}
      {activeTab === 'forms' && (
        <FormsTab
          forms={client.forms}
          packageType={client.packageType ?? null}
          clientId={client.id}
          services={client.services}
          emailLogs={client.emailLogs}
          onSendWelcome={triggerWelcome}
        />
      )}

      {/* ── FILES ── */}
      {activeTab === 'files' && (
        <FilesTab client={client} onUpdated={reload} />
      )}

      {/* ── EMAILS ── */}
      {activeTab === 'emails' && (
        <EmailsTab logs={client.emailLogs} />
      )}

      {/* ── ACTIVITY ── */}
      {activeTab === 'activity' && (
        <ActivityTab logs={client.activityLogs} />
      )}

      {/* ── REVISIONS ── */}
      {activeTab === 'revisions' && (
        <RevisionAdminTab clientId={client.id} clientName={client.name} clientPackage={client.packageType ?? null} services={client.services ?? []} />
      )}

      {/* ── COMMENTS ── */}
      {activeTab === 'comments' && (
        <CommentsAdminTab clientId={client.id} clientName={client.name} />
      )}

      {/* ── INVOICES ── */}
      {activeTab === 'invoices' && (
        <UpgradeInvoicesTab clientId={client.id} />
      )}

      {/* ── EDIT MODAL ── */}
      {showEdit && (
        <EditClientModal
          client={client}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); void reload(); }}
        />
      )}

      {/* ── DELETE — 2-step OTP flow ── */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-slate-200 animate-in zoom-in-95 duration-150">

            {/* ── Success state ── */}
            {deleteStep === 'done' ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" d="M5 13l4 4L19 7"/></svg>
                </div>
                <h3 className="font-bold text-slate-900 text-lg mb-1">Client deleted</h3>
                <p className="text-sm text-slate-500">
                  <strong className="text-slate-700">{client.name}</strong> and all associated data have been permanently removed.
                </p>
                <p className="text-xs text-slate-400 mt-3">Redirecting…</p>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-4 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path stroke="#dc2626" strokeWidth="2" strokeLinecap="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 text-base">Delete client?</h3>
                    <p className="text-slate-500 text-sm mt-1 leading-relaxed">
                      This will permanently delete <strong className="text-slate-700">{client.name}</strong> and all their
                      forms, files, email logs, and activity history. This action cannot be undone.
                    </p>
                  </div>
                </div>

                {deleteStep === 'idle' && (
                  <>
                    <p className="text-xs text-slate-400 mb-4">
                      For security, a 6-digit OTP will be emailed to{' '}
                      <strong>catalyst@theripplenexus.com</strong>. Enter it to confirm deletion.
                    </p>
                    <div className="flex gap-3 justify-end">
                      <button onClick={() => setShowDelete(false)}
                        className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          setDeleteStep('requesting'); setOtpError('');
                          const res = await fetch(`/api/career/admin/clients/${id}/delete-otp`, { method: 'POST' });
                          if (res.ok) { setDeleteStep('confirm'); }
                          else {
                            const d = await res.json().catch(() => ({})) as { error?: string };
                            setOtpError(d.error ?? 'Failed to send OTP.'); setDeleteStep('idle');
                          }
                        }}
                        className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors flex items-center gap-2">
                        Send OTP & Continue
                      </button>
                    </div>
                    {otpError && <p className="mt-3 text-xs text-red-600">{otpError}</p>}
                  </>
                )}

                {deleteStep === 'requesting' && (
                  <div className="flex items-center justify-center gap-2 py-4 text-sm text-slate-500">
                    <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                    Sending OTP to admin email…
                  </div>
                )}

                {(deleteStep === 'confirm' || deleteStep === 'deleting') && (
                  <>
                    <p className="text-xs text-[#9A7540] bg-[#FBF8F3] border border-[#E8DDD0] rounded-xl px-3 py-2 mb-4">
                      OTP sent to <strong>catalyst@theripplenexus.com</strong>. It expires in 10 minutes.
                    </p>
                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Enter 6-digit OTP</label>
                      <input
                        type="text" inputMode="numeric" maxLength={6} placeholder="••••••"
                        value={otpInput} onChange={e => { setOtpInput(e.target.value.replace(/\D/g, '')); setOtpError(''); }}
                        className="w-full px-4 py-2.5 text-lg font-mono tracking-[0.5em] text-center border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400"
                      />
                      {otpError && <p className="mt-1.5 text-xs text-red-600">{otpError}</p>}
                    </div>
                    <div className="flex gap-3 justify-end">
                      <button onClick={() => { setShowDelete(false); setDeleteStep('idle'); setOtpInput(''); setOtpError(''); }}
                        disabled={deleteStep === 'deleting'}
                        className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50">
                        Cancel
                      </button>
                      <button
                        disabled={otpInput.length !== 6 || deleteStep === 'deleting'}
                        onClick={async () => {
                          setDeleteStep('deleting'); setOtpError('');
                          const res = await fetch(`/api/career/admin/clients/${id}/delete-otp?otp=${otpInput}`, { method: 'DELETE' });
                          if (res.ok) {
                            setDeleteStep('done');
                            setTimeout(() => router.push('/career'), 1800);
                            return;
                          }
                          const d = await res.json().catch(() => ({})) as { error?: string };
                          setOtpError(d.error ?? 'Invalid OTP. Please try again.');
                          setDeleteStep('confirm');
                        }}
                        className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                        {deleteStep === 'deleting' && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                        {deleteStep === 'deleting' ? 'Deleting…' : 'Confirm Delete'}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ client, onUpdated, welcomeSignal }: { client: ClientDetail; onUpdated: () => void; welcomeSignal: number }) {
  const [statusLoading,   setStatusLoading]   = useState(false);
  const [pendingStatus,   setPendingStatus]   = useState<CareerStatus | null>(null);
  const [emailSending,    setEmailSending]    = useState(false);
  const [toast,           setToast]           = useState('');
  const emailPanelRef = useRef<HTMLDivElement>(null);

  // ── Derive client capabilities ──────────────────────────────────────────────
  const slugs = client.services?.map(s => s.slug) ?? [];
  const hasLinkedIn =
    slugs.some(s => ['LINKEDIN', 'FULL_PACKAGE'].includes(s)) ||
    ['LINKEDIN', 'FULL'].includes(client.packageType ?? '');
  const isLinkedInOnly =
    slugs.length > 0
      ? slugs.every(s => s === 'LINKEDIN')
      : client.packageType === 'LINKEDIN';

  // Which email auto-fires when a status changes (mirrors backend logic exactly)
  const autoEmailForStatus: Partial<Record<CareerStatus, { label: string }>> = {
    DRAFT_SENT:         { label: isLinkedInOnly ? 'LinkedIn Draft Ready' : 'Draft Ready' },
    REVISION_REQUESTED: { label: 'Revision Update' },
    COMPLETED:          { label: 'Final Delivery' + (hasLinkedIn ? ' + LinkedIn Security Steps' : '') },
  };

  // Filtered + annotated email triggers for this specific client
  const clientTriggers: (typeof EMAIL_TRIGGERS[number] & { auto?: string })[] =
    EMAIL_TRIGGERS
      .filter(t => {
        // Hide LinkedIn Security if client has no LinkedIn service
        if (t.value === 'LINKEDIN_SECURITY' && !hasLinkedIn) return false;
        return true;
      })
      .map(t => ({
        ...t,
        auto: t.value === 'DRAFT_READY'      ? 'Auto on Draft Sent'
            : t.value === 'REVISION'          ? 'Auto on Revision Requested'
            : t.value === 'FINAL_DELIVERY'    ? 'Auto on Completed'
            : undefined,
      }));

  // Group triggers for the manual send panel
  const draftTriggers    = clientTriggers.filter(t => ['DRAFT_READY','REVISED_DRAFT'].includes(t.value));
  const finalTriggers    = clientTriggers.filter(t => ['FINAL_DELIVERY','LINKEDIN_SECURITY'].includes(t.value));
  const accountTriggers  = clientTriggers.filter(t => ['WELCOME','FORM_CONFIRM','REVISION'].includes(t.value));

  const defaultTrigger: EmailTrigger =
    isLinkedInOnly ? 'DRAFT_READY' : 'WELCOME';
  const [selectedTrigger, setSelectedTrigger] = useState<EmailTrigger>(defaultTrigger);

  // Revision actions inline in the manual email panel
  const [pendingRevisions,  setPendingRevisions]  = useState<RevisionItem[]>([]);
  const [revsLoaded,        setRevsLoaded]        = useState(false);
  const [actioningId,       setActioningId]       = useState<string | null>(null);
  const [actionDecision,    setActionDecision]    = useState<'APPROVED' | 'DENIED' | null>(null);
  const [actionNote,        setActionNote]        = useState('');
  const [actionEmailOn,     setActionEmailOn]     = useState(true);
  const [actionSaving,      setActionSaving]      = useState(false);

  // Draft file picker — populated from client's uploaded drafts
  const draftDeliverables = client.deliverables.filter(d => d.fileCategory === 'draft');
  const mostRecentDraft   = draftDeliverables[0] ?? null; // already ordered desc
  const [selectedDraftFileType, setSelectedDraftFileType] = useState<string>(
    mostRecentDraft?.fileType ?? 'resume',
  );

  const DRAFT_TRIGGERS = new Set<EmailTrigger>(['DRAFT_READY', 'LINKEDIN_DRAFT', 'REVISED_DRAFT']);
  const isDraftTrigger = DRAFT_TRIGGERS.has(selectedTrigger);

  // Map fileType → friendly label (mirrors backend)
  const FILE_TYPE_LABELS: Record<string, string> = {
    resume:                   'Resume',
    cover_letter:             'Cover Letter',
    linkedin_banner:          'LinkedIn Profile',
    linkedin_profile_picture: 'LinkedIn Profile',
    linkedin_optimization:    'LinkedIn Profile',
    linkedin_content:         'LinkedIn Profile',
    portfolio:                'Portfolio',
  };
  const draftEmailLabel = FILE_TYPE_LABELS[selectedDraftFileType]
    ?? selectedDraftFileType.replace(/_/g, ' ');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  // When banner/Forms tab triggers welcome signal, auto-select WELCOME and scroll
  useEffect(() => {
    if (welcomeSignal > 0) {
      setSelectedTrigger('WELCOME');
      setTimeout(() => emailPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  }, [welcomeSignal]);

  // Lazy-load pending revisions when admin selects the REVISION trigger
  useEffect(() => {
    if (selectedTrigger !== 'REVISION' || revsLoaded) return;
    fetch(`/api/career/admin/clients/${client.id}/revisions`)
      .then(r => r.json() as Promise<{ revisions: RevisionItem[] }>)
      .then(d => {
        setPendingRevisions((d.revisions ?? []).filter(r => r.status === 'PENDING'));
        setRevsLoaded(true);
      })
      .catch(() => setRevsLoaded(true));
  }, [selectedTrigger, revsLoaded, client.id]);

  const actOnRevision = async (revisionId: string, decision: 'APPROVED' | 'DENIED') => {
    setActionSaving(true);
    const doEmail = actionEmailOn;
    const res = await fetch(`/api/career/admin/clients/${client.id}/revisions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        revisionId,
        status: decision,
        adminNote: actionNote.trim() || undefined,
        sendEmail: doEmail,
      }),
    });
    setActionSaving(false);
    if (res.ok) {
      setPendingRevisions(prev => prev.filter(r => r.id !== revisionId));
      setActioningId(null);
      setActionDecision(null);
      setActionNote('');
      const decisionLabel = decision === 'APPROVED' ? 'approved' : 'denied';
      showToast(`Revision ${decisionLabel}${doEmail ? ` - email sent to ${client.name.split(' ')[0]}` : ''}`);
      onUpdated();
    }
  };

  const confirmStatusChange = async () => {
    if (!pendingStatus) return;
    setStatusLoading(true);
    const res = await fetch(`/api/career/admin/clients/${client.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: pendingStatus }),
    });
    const d = await res.json().catch(() => ({})) as {
      statusLabel?: string;
      emailTriggered?: boolean;
      emailTrigger?: string;
      error?: string;
    };
    setStatusLoading(false);
    if (res.ok) {
      setPendingStatus(null);
      const autoLabel = d.emailTrigger
        ? clientTriggers.find(t => t.value === d.emailTrigger)?.label
          ?? EMAIL_TRIGGERS.find(t => t.value === d.emailTrigger)?.label
        : null;
      showToast(autoLabel
        ? `Status updated to "${d.statusLabel}" - "${autoLabel}" email sent automatically`
        : `Status updated to "${d.statusLabel}"`);
      onUpdated();
    } else {
      showToast(`Error: ${d.error ?? 'Status update failed'}`);
    }
  };

  const sendEmail = async () => {
    setEmailSending(true);
    const res = await fetch(`/api/career/admin/clients/${client.id}/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trigger: selectedTrigger,
        ...(isDraftTrigger && { fileType: selectedDraftFileType }),
      }),
    });
    setEmailSending(false);
    if (res.ok) {
      const label = clientTriggers.find(t => t.value === selectedTrigger)?.label ?? selectedTrigger;
      const docNote = isDraftTrigger ? ` for "${draftEmailLabel}"` : '';
      showToast(`"${label}" email sent to ${client.email}${docNote}`);
      onUpdated();
    } else {
      const d = await res.json() as { error?: string };
      showToast(`Error: ${d.error ?? 'Send failed'}`);
    }
  };

  const selectedLabel = clientTriggers.find(t => t.value === selectedTrigger)?.label ?? selectedTrigger;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Toast */}
      {toast && (
        <div className="lg:col-span-2 flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-medium">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          {toast}
        </div>
      )}

      {/* Status confirmation modal */}
      {pendingStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 border border-slate-200">
            <h3 className="font-bold text-slate-900 text-base mb-2">Confirm status change</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Change status to <strong className="text-slate-700">{STATUS_LABELS[pendingStatus]}</strong>?
            </p>
            {autoEmailForStatus[pendingStatus] && (
              <div className="mt-3 flex items-start gap-2.5 px-3.5 py-2.5 bg-[#FBF8F3] border border-[#E8DDD0] rounded-xl">
                <svg className="mt-0.5 flex-shrink-0" width="14" height="14" fill="none" viewBox="0 0 24 24">
                  <path stroke="#B8935B" strokeWidth="2" strokeLinecap="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                <p className="text-xs text-[#9A7540] leading-relaxed">
                  <strong>&quot;{autoEmailForStatus[pendingStatus]!.label}&quot;</strong> email will be sent to{' '}
                  <span className="font-medium">{client.name}</span> automatically.
                </p>
              </div>
            )}
            <div className="flex gap-3 justify-end mt-5">
              <button onClick={() => setPendingStatus(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={confirmStatusChange} disabled={statusLoading}
                className="px-4 py-2 text-sm font-bold text-white bg-[#B8935B] rounded-xl hover:bg-[#9A7540] transition-colors disabled:opacity-50">
                {statusLoading ? 'Updating...' : 'Yes, Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status control */}
      <Card title="Update Status" icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>}>
        {(() => {
          const MAIN_STEPS: { status: CareerStatus; short: string }[] = [
            { status: 'NOT_STARTED',   short: 'Not Started'   },
            { status: 'SUBMITTED',     short: 'Forms In'      },
            { status: 'UNDER_PROCESS', short: 'In Progress'   },
            { status: 'DRAFT_SENT',    short: 'Draft Review'  },
            { status: 'COMPLETED',     short: 'Delivered'     },
          ];
          const isRevision   = client.status === 'REVISION_REQUESTED';
          const effectiveIdx = MAIN_STEPS.findIndex(s =>
            isRevision ? s.status === 'DRAFT_SENT' : s.status === client.status
          );
          const tier = getPackageTier(slugs);
          type Chip = { label: string; type: string };
          const TIER_CHIPS: Record<string, Partial<Record<string, Chip[]>>> = {
            premium: {
              DRAFT_SENT: [
                { label: 'Resume',           type: 'resume'       },
                { label: 'Cover Letter',     type: 'cover_letter' },
                { label: 'LinkedIn Profile', type: 'linkedin'     },
                { label: 'Portfolio',        type: 'portfolio'    },
              ],
              COMPLETED: [
                { label: 'Resume',            type: 'resume'       },
                { label: 'Cover Letter',      type: 'cover_letter' },
                { label: 'LinkedIn Profile',  type: 'linkedin'     },
                { label: 'Portfolio Website', type: 'portfolio'    },
              ],
            },
            booster: {
              DRAFT_SENT: [
                { label: 'Resume',           type: 'resume'       },
                { label: 'Cover Letter',     type: 'cover_letter' },
                { label: 'LinkedIn Profile', type: 'linkedin'     },
              ],
              COMPLETED: [
                { label: 'Resume',           type: 'resume'       },
                { label: 'Cover Letter',     type: 'cover_letter' },
                { label: 'LinkedIn Profile', type: 'linkedin'     },
              ],
            },
            resume_cl: {
              DRAFT_SENT: [
                { label: 'Resume Draft',       type: 'resume'       },
                { label: 'Cover Letter Draft', type: 'cover_letter' },
              ],
              COMPLETED: [
                { label: 'Resume',       type: 'resume'       },
                { label: 'Cover Letter', type: 'cover_letter' },
              ],
            },
            resume: {
              DRAFT_SENT: [{ label: 'Resume Draft', type: 'resume' }],
              COMPLETED:  [{ label: 'Resume',       type: 'resume' }],
            },
          };
          const TIER_LABEL: Record<string, string> = {
            premium:   'Premium Plus Package',
            booster:   'Career Booster Package',
            resume_cl: 'Resume & Cover Letter',
            resume:    'Resume Writing',
          };
          const normType = (t: string) => t.startsWith('linkedin') ? 'linkedin' : t;
          const uniqueDeliverableChips = (files: Deliverable[]): Chip[] => {
            const seen = new Set<string>();
            return files.reduce<Chip[]>((acc, d) => {
              const k = normType(d.fileType);
              if (!seen.has(k)) {
                seen.add(k);
                acc.push({
                  label: k === 'linkedin' ? 'LinkedIn Profile'
                       : FILE_TYPE_LABELS[d.fileType] ?? d.fileType.replace(/_/g, ' '),
                  type: k,
                });
              }
              return acc;
            }, []);
          };
          let currentChips: Chip[] = [];
          let processLabel = '';
          if (client.status === 'UNDER_PROCESS') {
            processLabel = TIER_LABEL[tier] ?? 'Your Package';
          } else if (client.status === 'DRAFT_SENT' || isRevision) {
            const draftFiles = client.deliverables.filter(d => d.fileCategory === 'draft');
            currentChips = draftFiles.length > 0
              ? uniqueDeliverableChips(draftFiles)
              : (TIER_CHIPS[tier]?.DRAFT_SENT ?? []);
          } else if (client.status === 'COMPLETED') {
            const finalFiles = client.deliverables.filter(d => d.fileCategory !== 'draft');
            currentChips = finalFiles.length > 0
              ? uniqueDeliverableChips(finalFiles)
              : (TIER_CHIPS[tier]?.COMPLETED ?? []);
          }
          const chipClass = isRevision || client.status === 'DRAFT_SENT'
            ? 'bg-purple-50 border-purple-100 text-purple-700'
            : 'bg-emerald-50 border-emerald-100 text-emerald-700';
          const wrapColor = client.status === 'DRAFT_SENT' || isRevision
            ? 'bg-purple-50 border-purple-100'
            : 'bg-emerald-50 border-emerald-100';
          const chipSvg = (type: string) => {
            if (type === 'resume') return (
              <svg width="10" height="10" fill="none" viewBox="0 0 24 24" style={{flexShrink:0}}>
                <path stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            );
            if (type === 'cover_letter') return (
              <svg width="10" height="10" fill="none" viewBox="0 0 24 24" style={{flexShrink:0}}>
                <path stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
            );
            if (type === 'linkedin') return (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{flexShrink:0}}>
                <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-4 0v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
                <circle cx="4" cy="4" r="2"/>
              </svg>
            );
            if (type === 'portfolio') return (
              <svg width="10" height="10" fill="none" viewBox="0 0 24 24" style={{flexShrink:0}}>
                <path stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
              </svg>
            );
            return null;
          };

          return (
            <div className="space-y-3">
              {/* Horizontal stepper */}
              <div className="flex items-start">
                {MAIN_STEPS.map((step, idx) => {
                  const isPast    = idx < effectiveIdx;
                  const isCurrent = idx === effectiveIdx;
                  return (
                    <div key={step.status} className="flex-1 flex flex-col items-center relative min-w-0">
                      {/* Connector line */}
                      {idx < MAIN_STEPS.length - 1 && (
                        <div className={`absolute top-3.5 h-px z-0 ${isPast ? 'bg-[#B8935B]' : 'bg-slate-200'}`}
                          style={{ left: 'calc(50% + 14px)', right: '-1px' }} />
                      )}
                      {/* Circle */}
                      <button
                        onClick={() => setPendingStatus(step.status)}
                        disabled={statusLoading || isCurrent}
                        title={isCurrent ? `${STATUS_LABELS[step.status]} (current)` : `Set to ${STATUS_LABELS[step.status]}`}
                        className={`relative z-10 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 disabled:cursor-default ${
                          isPast    ? 'bg-[#B8935B] border-[#B8935B] text-white hover:bg-[#9A7540]'
                          : isCurrent ? 'border-[#B8935B] bg-white ring-2 ring-[#B8935B]/20'
                          : 'border-slate-200 bg-white text-slate-300 hover:border-[#D4AF7A] hover:text-[#B8935B]'
                        }`}>
                        {isPast ? (
                          <svg width="11" height="11" fill="none" viewBox="0 0 24 24">
                            <path stroke="currentColor" strokeWidth="3" strokeLinecap="round" d="M5 13l4 4L19 7"/>
                          </svg>
                        ) : isCurrent ? (
                          <span className={`w-2.5 h-2.5 rounded-full ${STATUS_STYLES[step.status].dot}`} />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-slate-200" />
                        )}
                      </button>
                      {/* Label */}
                      <p className={`mt-1 text-center text-[9px] font-bold leading-tight px-0.5 ${
                        isCurrent ? 'text-[#9A7540]' : isPast ? 'text-slate-400' : 'text-slate-300'
                      }`}>
                        {step.short}
                      </p>
                      {isCurrent && <span className="text-[8px] text-slate-400">Current</span>}
                      {/* Auto-email hint — only on future steps */}
                      {autoEmailForStatus[step.status] && !isCurrent && !isPast && (
                        <p className="text-[8px] text-[#B8935B]/70 mt-0.5 text-center leading-tight px-0.5">
                          {autoEmailForStatus[step.status]!.label.split('+')[0].trim()}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Service context for current step */}
              {processLabel ? (
                <div className="px-3 py-2 rounded-xl border bg-amber-50 border-amber-100 flex items-center gap-2">
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" style={{color:'#B8935B',flexShrink:0}}>
                    <path stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                  </svg>
                  <span className="text-xs font-semibold text-amber-800">{processLabel}</span>
                  <span className="text-[10px] text-amber-600 ml-auto">In Progress</span>
                </div>
              ) : currentChips.length > 0 ? (
                <div className={`px-3 py-2.5 rounded-xl border flex flex-wrap gap-1.5 ${wrapColor}`}>
                  {currentChips.map((chip) => (
                    <span key={chip.type} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${chipClass}`}>
                      {chipSvg(chip.type)}
                      {chip.label}
                    </span>
                  ))}
                </div>
              ) : null}

              {/* Revision branch */}
              <div
                onClick={() => !statusLoading && !isRevision && setPendingStatus('REVISION_REQUESTED')}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all ${
                  isRevision
                    ? 'bg-orange-50 border-orange-200 text-orange-700 cursor-default'
                    : 'bg-slate-50 border-slate-100 text-slate-400 cursor-pointer hover:border-orange-200 hover:text-orange-600 hover:bg-orange-50/50'
                }`}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
                  <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                <span className="font-semibold">Revision Requested</span>
                {isRevision
                  ? <span className="ml-auto text-[9px] bg-orange-100 border border-orange-200 px-1.5 py-0.5 rounded font-bold uppercase">Current</span>
                  : <span className="ml-auto text-[9px] opacity-50">→ mark as revision</span>}
                {autoEmailForStatus.REVISION_REQUESTED && !isRevision && (
                  <span className="text-[9px] text-[#B8935B]/70">Sends: {autoEmailForStatus.REVISION_REQUESTED.label}</span>
                )}
              </div>
            </div>
          );
        })()}
      </Card>

      {/* Email trigger */}
      <div ref={emailPanelRef}>
      <Card title="Send Email Manually" icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>}>
        <div className="space-y-4">

          {/* Draft notifications */}
          {draftTriggers.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Draft Notifications</p>
              </div>
              <div className="space-y-1.5 pl-1">
                {draftTriggers.map(t => (
                  <label key={t.value}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedTrigger === t.value
                        ? 'border-amber-300 bg-amber-50'
                        : 'border-slate-200 hover:border-amber-200 hover:bg-amber-50/40'
                    }`}>
                    <input type="radio" name="trigger" value={t.value}
                      checked={selectedTrigger === t.value}
                      onChange={() => setSelectedTrigger(t.value)}
                      className="mt-1 accent-amber-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-800">{t.label}</p>
                        {t.auto && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium border border-amber-200">
                            {t.auto}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{t.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Final delivery */}
          {finalTriggers.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Final Delivery</p>
              </div>
              <div className="space-y-1.5 pl-1">
                {finalTriggers.map(t => (
                  <label key={t.value}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedTrigger === t.value
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/40'
                    }`}>
                    <input type="radio" name="trigger" value={t.value}
                      checked={selectedTrigger === t.value}
                      onChange={() => setSelectedTrigger(t.value)}
                      className="mt-1 accent-emerald-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-800">{t.label}</p>
                        {t.auto && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-medium border border-emerald-200">
                            {t.auto}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{t.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Account & updates */}
          {accountTriggers.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" />
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Account & Updates</p>
              </div>
              <div className="space-y-1.5 pl-1">
                {accountTriggers.map(t => (
                  <div key={t.value}>
                    <label
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedTrigger === t.value
                          ? 'border-[#D4AF7A] bg-[#FBF8F3]'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}>
                      <input type="radio" name="trigger" value={t.value}
                        checked={selectedTrigger === t.value}
                        onChange={() => { setSelectedTrigger(t.value); setActioningId(null); setActionNote(''); }}
                        className="mt-1 accent-[#B8935B] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-slate-800">{t.label}</p>
                          {t.auto && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-medium border border-slate-200">
                              {t.auto}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{t.desc}</p>
                      </div>
                    </label>

                    {/* Welcome Email expansion — shown when WELCOME is selected */}
                    {t.value === 'WELCOME' && selectedTrigger === 'WELCOME' && (() => {
                      const prevWelcome = client.emailLogs.find(l => l.trigger === 'WELCOME');
                      const tier = getPackageTier(slugs);
                      const tierLabel = tier === 'premium' ? 'Premium Plus Package'
                        : tier === 'booster' ? 'Career Booster Package'
                        : tier === 'resume_cl' ? 'Resume Writing + Cover Letter'
                        : tier === 'resume' ? 'Resume Writing'
                        : 'Career Services';
                      const tierServices = tier === 'premium' ? 'Resume · Cover Letter · LinkedIn · Portfolio'
                        : tier === 'booster' ? 'Resume · Cover Letter · LinkedIn Optimisation'
                        : tier === 'resume_cl' ? 'Resume Rewrite · Cover Letter Writing'
                        : tier === 'resume' ? 'Resume Rewrite'
                        : '';
                      return (
                        <div className="mt-1.5 ml-1 space-y-2">
                          {prevWelcome && (
                            <div className="px-3.5 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                              <p className="text-xs font-bold text-amber-800">
                                ⚠ Welcome email was sent {relativeTime(prevWelcome.sentAt)}
                              </p>
                              <p className="text-xs text-amber-700 mt-0.5">
                                Sending again will generate a new magic link — the previous one stops working immediately.
                              </p>
                            </div>
                          )}
                          <div className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">What this email contains</p>
                            <p className="text-xs text-slate-600 mb-1.5 font-medium">Subject: Welcome to Catalyst Career Boost</p>
                            <div className="space-y-0.5">
                              {[
                                '✓ Fresh magic link (expires in 7 days)',
                                `✓ Package: ${tierLabel}`,
                                ...(tierServices ? [`   ${tierServices}`] : []),
                                '✓ Direct portal login URL',
                              ].map((line, i) => (
                                <p key={i} className={`text-xs leading-relaxed ${line.startsWith('   ') ? 'text-slate-400 pl-4' : 'text-emerald-700 font-medium'}`}>
                                  {line.trim()}
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Revision action panel — shown inline when REVISION is selected */}
                    {t.value === 'REVISION' && selectedTrigger === 'REVISION' && (
                      <div className="mt-1.5 ml-1 px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <p className="text-xs font-bold text-slate-600 mb-2.5 uppercase tracking-wide">
                          Pending Revision Requests
                        </p>

                        {!revsLoaded ? (
                          <div className="flex items-center gap-2 py-2 text-xs text-slate-400">
                            <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                            Loading revisions…
                          </div>
                        ) : pendingRevisions.length === 0 ? (
                          <p className="text-xs text-slate-400 italic py-1">
                            No pending revisions. Use the Revisions tab to view all requests.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {pendingRevisions.map(r => (
                              <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-3">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="flex-1 min-w-0">
                                    {r.fileLabel && (
                                      <p className="text-xs font-bold text-[#9A7540] mb-0.5">Re: {r.fileLabel}</p>
                                    )}
                                    <p className="text-xs text-slate-700 leading-relaxed line-clamp-2">{r.note}</p>
                                    <p className="text-[10px] text-slate-400 mt-1">{fmt(r.createdAt)} · by {r.requestedBy === 'client' ? 'Client' : 'Admin'}</p>
                                  </div>
                                </div>

                                {actioningId === r.id && actionDecision ? (
                                  <div className="space-y-2 pt-2 border-t border-slate-100">
                                    <div className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
                                      actionDecision === 'APPROVED'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-red-50 text-red-700 border border-red-200'
                                    }`}>
                                      {actionDecision === 'APPROVED' ? 'Approving revision' : 'Denying revision'}
                                      {actionEmailOn && ` - email will be sent to ${client.name.split(' ')[0]}`}
                                    </div>
                                    <textarea
                                      rows={2}
                                      value={actionNote}
                                      onChange={e => setActionNote(e.target.value)}
                                      placeholder={actionDecision === 'DENIED' ? 'Reason for denial (recommended)…' : 'Optional note to client…'}
                                      className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C4A070] resize-none"
                                    />
                                    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                                      <input type="checkbox" checked={actionEmailOn} onChange={e => setActionEmailOn(e.target.checked)}
                                        className="accent-[#B8935B]" />
                                      Send email notifying client
                                    </label>
                                    <div className="flex gap-2">
                                      <button
                                        disabled={actionSaving}
                                        onClick={() => actOnRevision(r.id, actionDecision)}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg disabled:opacity-50 transition-colors ${
                                          actionDecision === 'APPROVED'
                                            ? 'text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100'
                                            : 'text-red-700 bg-red-50 border border-red-200 hover:bg-red-100'
                                        }`}>
                                        {actionSaving ? '…' : `Confirm ${actionDecision === 'APPROVED' ? 'Approve' : 'Deny'}`}
                                      </button>
                                      <button
                                        onClick={() => { setActioningId(null); setActionDecision(null); setActionNote(''); }}
                                        className="px-3 py-1.5 text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex gap-2 pt-2 border-t border-slate-100">
                                    <button
                                      onClick={() => { setActioningId(r.id); setActionDecision('APPROVED'); setActionNote(''); setActionEmailOn(true); }}
                                      className="flex-1 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors">
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => { setActioningId(r.id); setActionDecision('DENIED'); setActionNote(''); setActionEmailOn(true); }}
                                      className="flex-1 py-1.5 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
                                      Deny
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Document picker — only visible when a draft trigger is selected */}
        {isDraftTrigger && (
          <div className="mt-1 px-3.5 py-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs font-bold text-amber-800 mb-2 uppercase tracking-wide">
              Which document is this draft for?
            </p>
            {draftDeliverables.length > 0 ? (
              <div className="space-y-1.5">
                {draftDeliverables.map(d => (
                  <label key={d.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                      selectedDraftFileType === d.fileType
                        ? 'bg-white border-amber-400 shadow-sm'
                        : 'bg-white/60 border-amber-100 hover:border-amber-300'
                    }`}>
                    <input type="radio" name="draftFile" value={d.fileType}
                      checked={selectedDraftFileType === d.fileType}
                      onChange={() => setSelectedDraftFileType(d.fileType)}
                      className="accent-amber-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{d.label}</p>
                      <p className="text-xs text-amber-700">
                        Email will say: <strong>{FILE_TYPE_LABELS[d.fileType] ?? d.fileType.replace(/_/g, ' ')}</strong>
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  value={selectedDraftFileType}
                  onChange={e => setSelectedDraftFileType(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-amber-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
                  {FILE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <p className="text-xs text-amber-600 flex-shrink-0">No drafts uploaded yet</p>
              </div>
            )}
            <p className="mt-2 text-xs text-amber-600">
              Client will receive an email titled: <strong>&quot;Catalyst - Your {draftEmailLabel} draft is ready for review&quot;</strong>
            </p>
          </div>
        )}

        {selectedTrigger === 'REVISION' ? (
          <p className="mt-3 text-xs text-slate-400 text-center">
            Use the Approve / Deny buttons above to send the revision email.
          </p>
        ) : (
          <button onClick={sendEmail} disabled={emailSending}
            className={`mt-4 w-full py-2.5 text-white text-sm font-bold rounded-xl disabled:opacity-50 transition-colors ${
              draftTriggers.some(t => t.value === selectedTrigger)
                ? 'bg-amber-600 hover:bg-amber-700'
                : finalTriggers.some(t => t.value === selectedTrigger)
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-slate-900 hover:bg-slate-700'
            }`}>
            {emailSending
              ? <span className="flex items-center justify-center gap-2"><Spinner /><span>Sending...</span></span>
              : isDraftTrigger
                ? `Send "${selectedLabel}" for ${draftEmailLabel} to ${client.name.split(' ')[0]}`
                : `Send "${selectedLabel}" to ${client.name.split(' ')[0]}`}
          </button>
        )}
      </Card>
      </div>

      {/* Portal link */}
      <Card title="Client Portal" icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>}>
        <p className="text-sm text-slate-500 mb-3">
          Share this link with the client. They can login via magic link request on this page.
        </p>
        <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <code className="text-xs text-slate-600 flex-1 truncate">
            {`${process.env.NEXT_PUBLIC_APP_URL ?? 'https://catalyst.theripplenexus.com'}/portal/login`}
          </code>
          <button
            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/portal/login`).then(() => showToast('Copied!'))}
            className="px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-600 flex-shrink-0">
            Copy
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          To send a fresh magic link, trigger <strong>Welcome Email</strong> above.
        </p>
      </Card>

      {/* Order info */}
      <Card title="Order Details" icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>}>
        <dl className="space-y-2.5">
          {[
            ['Services',
              client.services?.length > 0
                ? client.services.map(s => SERVICE_LABELS[s.slug as CareerServiceSlug] ?? s.name).join(', ')
                : client.packageType ? PACKAGE_LABELS[client.packageType] : 'Career Services'],
            ['Amount Paid', `${client.currency} ${client.amountPaid.toLocaleString()}`],
            ['Joined',      fmt(client.createdAt)],
            ['Last Login',  client.lastLoginAt ? fmt(client.lastLoginAt) : 'Never'],
            ...(client.invoiceId ? [['Invoice ID', client.invoiceId]] : []),
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <dt className="text-slate-500">{label}</dt>
              <dd className="font-semibold text-slate-800 text-right max-w-[200px] truncate">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* Feedback & Review */}
      {(client.Feedback || client.Review) && (
        <Card title="Client Feedback" icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>}>
          <div className="space-y-4">
            {client.Feedback && (
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">NPS Score</p>
                  <p className="text-2xl font-black text-slate-800">{client.Feedback.npsScore} <span className="text-sm font-medium text-slate-400">/ 10</span></p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Rating</p>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <svg key={star} width="20" height="20" viewBox="0 0 24 24" fill={star <= client.Feedback!.rating ? '#F59E0B' : '#E2E8F0'}>
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {client.Review && (
              <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-sm text-slate-700 italic">&quot;{client.Review.content}&quot;</p>
                <div className="mt-3 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${client.Review.permissionToUse ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <p className="text-xs text-slate-500">
                    {client.Review.permissionToUse ? 'Permission granted to use as testimonial' : 'Private feedback'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Forms Tab ─────────────────────────────────────────────────────────────────

function FormsTab({ forms, packageType, clientId, services, emailLogs, onSendWelcome }: {
  forms: FormSubmission[];
  packageType: CareerPackage | null;
  clientId: string;
  services: { slug: string; name: string }[];
  emailLogs: EmailLog[];
  onSendWelcome: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const welcomeSent = emailLogs.some(l => l.trigger === 'WELCOME');

  if (forms.length === 0) {
    return (
      <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-10 text-center">
        <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-400">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
        </div>
        {!welcomeSent ? (
          <>
            <p className="text-slate-700 font-semibold text-sm">Portal not yet activated</p>
            <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto">
              Send the Welcome Email first so the client can log in and submit their intake forms.
            </p>
            <button
              onClick={onSendWelcome}
              className="mt-4 px-4 py-2 bg-[#B8935B] text-white text-xs font-bold rounded-xl hover:bg-[#9A7540] transition-colors">
              Send Welcome Email →
            </button>
          </>
        ) : (
          <>
            <p className="text-slate-700 font-semibold text-sm">No forms submitted yet</p>
            <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto">
              Forms will appear here once the client submits them via the portal. The Welcome email has been sent.
            </p>
          </>
        )}
      </div>
    );
  }

  // Group by formType, show latest version per type prominently
  const byType = forms.reduce<Record<string, FormSubmission[]>>((acc, f) => {
    (acc[f.formType] ??= []).push(f);
    return acc;
  }, {});

  // Progress tracker — compute required forms from services
  const { SERVICE_FORM_MAP, PACKAGE_FORMS, normalizeFormType } = require('@/lib/career/types') as typeof import('@/lib/career/types');
  const slugs = services.map(s => s.slug);
  const tier = getPackageTier(slugs);
  let required: string[] = [];
  if (slugs.length > 0) {
    const seen = new Set<string>();
    for (const slug of slugs) {
      const forms = (SERVICE_FORM_MAP as Record<string, string[]>)[slug] ?? [];
      for (const f of forms) { seen.add(f); }
    }
    required = Array.from(seen);
  } else if (packageType) {
    required = (PACKAGE_FORMS as Record<string, string[]>)[packageType] ?? [];
  }
  const submittedTypes = new Set(Object.keys(byType).map((t: string) => normalizeFormType(t)));
  const submittedCount = required.filter(r => submittedTypes.has(normalizeFormType(r))).length;
  const totalRequired  = required.length;

  return (
    <div className="space-y-4">
      {/* Progress tracker */}
      {totalRequired > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Form Progress</p>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              submittedCount === totalRequired ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {submittedCount} / {totalRequired} submitted
            </span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${submittedCount === totalRequired ? 'bg-emerald-500' : 'bg-[#B8935B]'}`}
              style={{ width: `${totalRequired > 0 ? (submittedCount / totalRequired) * 100 : 0}%` }}
            />
          </div>
          {submittedCount < totalRequired && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {required
                .filter(r => !submittedTypes.has(normalizeFormType(r)))
                .map((r: string) => (
                  <span key={r} className="text-[10px] px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-full font-medium">
                    {FORM_TYPE_LABELS[r] ?? r} pending
                  </span>
                ))}
            </div>
          )}
        </div>
      )}

      {Object.entries(byType).map(([type, submissions]) => {
        const latest = submissions[0]; // already ordered desc by version
        const isOpen = expanded === type;
        return (
          <div key={type} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {/* Header */}
            <button onClick={() => setExpanded(isOpen ? null : type)}
              className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-[#B8935B]">
                  {type === 'resume' ? (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6M9 13h6M9 17h4"/></svg>
                  ) : type === 'linkedin' ? (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="2"/><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M7 10v7M7 7v.5M12 17v-4a2 2 0 014 0v4M12 13v4"/></svg>
                  ) : (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  )}
                </span>
                <div className="text-left">
                  <p className="font-bold text-slate-900">{FORM_TYPE_LABELS[type] ?? type}</p>
                  <p className="text-xs text-slate-400">
                    v{latest.version} · Submitted {fmt(latest.submittedAt)}
                    {submissions.length > 1 && ` · ${submissions.length} versions`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                  Latest: v{latest.version}
                </span>
                <svg className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M19 9l-7 7-7-7"/></svg>
              </div>
            </button>

            {/* Body */}
            {isOpen && (
              <div className="border-t border-slate-100 p-5">
                <FormDataViewer data={latest.formData} clientId={clientId} />
                {submissions.length > 1 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                      Previous versions
                    </p>
                    <div className="space-y-2">
                      {submissions.slice(1).map(s => (
                        <details key={s.id} className="group">
                          <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700 list-none flex items-center gap-1">
                            <svg className="w-3 h-3 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24">
                              <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M9 18l6-6-6-6"/>
                            </svg>
                            v{s.version} · {fmt(s.submittedAt)}
                          </summary>
                          <div className="mt-2 ml-4">
                            <FormDataViewer data={s.formData} compact clientId={clientId} />
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Missing forms warning — shown only if progress tracker is not already displayed */}
      {totalRequired === 0 && (() => {
        const {
          PACKAGE_FORMS: PF, normalizeFormType: norm,
        } = require('@/lib/career/types') as typeof import('@/lib/career/types');
        const req: string[] = packageType ? (PF[packageType] ?? []) : [];
        const submitted = new Set(Object.keys(byType).map((t: string) => norm(t)));
        const missing = req.filter((r: string) => !submitted.has(norm(r)));
        if (missing.length === 0) return null;
        return (
          <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            <strong>Pending:</strong> {missing.map((m: string) => FORM_TYPE_LABELS[m] ?? m).join(', ')} form{missing.length > 1 ? 's' : ''} not yet submitted.
          </div>
        );
      })()}
    </div>
  );
}

// ── Files Tab ─────────────────────────────────────────────────────────────────

function FilesTab({ client, onUpdated }: { client: ClientDetail; onUpdated: () => void }) {
  const clientId    = client.id;
  const deliverables = client.deliverables;

  const [label,        setLabel]        = useState('');
  const [fileType,     setFileType]     = useState(FILE_TYPES[0].value);
  const [fileCategory, setFileCategory] = useState<'draft' | 'final'>('draft');
  const [sendEmail,    setSendEmail]    = useState(true);
  const [uploading,    setUploading]    = useState(false);
  const [error,        setError]        = useState('');
  const [toast,        setToast]        = useState('');
  const [deleting,     setDeleting]     = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  // Derive what email will be sent for current selection (mirrors backend logic)
  const LINKEDIN_TYPES = new Set(['linkedin_banner', 'linkedin_profile_picture', 'linkedin_optimization', 'linkedin_content']);
  const hasRevisions = false; // unknown on frontend — backend checks this
  function previewEmailTrigger(): string {
    if (!sendEmail) return '';
    if (fileCategory === 'final') return 'Catalyst - Your deliverables are ready';
    if (LINKEDIN_TYPES.has(fileType)) return 'Catalyst - Your LinkedIn profile optimisation draft is ready';
    // We don't know revision count on frontend — backend decides REVISED_DRAFT vs DRAFT_READY
    return 'Catalyst - Your draft is ready for review';
  }
  const emailPreview = previewEmailTrigger();

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError('Select a file'); return; }
    if (!label.trim()) { setError('Enter a label'); return; }
    if (file.size > 20 * 1024 * 1024) { setError('File too large (max 20 MB)'); return; }
    setError(''); setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('label', label.trim());
    fd.append('fileType', fileType);
    fd.append('fileCategory', fileCategory);
    fd.append('sendEmail', String(sendEmail));
    const res  = await fetch(`/api/career/admin/clients/${clientId}/files`, { method: 'POST', body: fd });
    const data = await res.json() as { error?: string; emailTrigger?: string | null };
    setUploading(false);
    if (!res.ok) { setError(data.error ?? 'Upload failed'); return; }
    setLabel('');
    setFileType(FILE_TYPES[0].value);
    if (fileRef.current) fileRef.current.value = '';
    const EMAIL_LABELS: Record<string, string> = {
      DRAFT_READY: 'Draft Ready', LINKEDIN_DRAFT: 'LinkedIn Draft Ready',
      REVISED_DRAFT: 'Revised Draft Ready', FINAL_DELIVERY: 'Final Delivery',
    };
    const emailNote = data.emailTrigger
      ? ` - "${EMAIL_LABELS[data.emailTrigger] ?? data.emailTrigger}" email sent`
      : '';
    showToast(`${fileCategory === 'draft' ? 'Draft' : 'Final deliverable'} uploaded${emailNote}`);
    onUpdated();
  };

  const deleteFile = async (fileId: string) => {
    if (!confirm('Delete this file? This cannot be undone.')) return;
    setDeleting(fileId);
    await fetch(`/api/career/admin/clients/${clientId}/files?fileId=${fileId}`, { method: 'DELETE' });
    setDeleting(null);
    showToast('File deleted');
    onUpdated();
  };

  const drafts  = deliverables.filter(f => f.fileCategory === 'draft');
  const finals  = deliverables.filter(f => f.fileCategory !== 'draft');
  const remaining = 10 - finals.length;

  return (
    <div className="space-y-4">
      {toast && <Toast msg={toast} />}

      {/* Upload card */}
      <Card title={`Upload File (${drafts.length} draft${drafts.length !== 1 ? 's' : ''}, ${finals.length} final${finals.length !== 1 ? 's' : ''})`}
        icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>}>
        <div className="space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          {/* Category toggle */}
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">File Type</p>
            <div className="grid grid-cols-2 gap-2">
              {(['draft', 'final'] as const).map(cat => (
                <button key={cat} type="button"
                  onClick={() => setFileCategory(cat)}
                  className={`py-2.5 px-4 rounded-xl text-sm font-semibold border transition-all ${
                    fileCategory === cat
                      ? cat === 'draft'
                        ? 'bg-amber-50 border-amber-300 text-amber-700'
                        : 'bg-emerald-50 border-emerald-300 text-emerald-700'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}>
                  {cat === 'draft' ? 'Draft' : 'Final Deliverable'}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              {fileCategory === 'draft'
                ? 'Draft files are for client review — they can request revisions.'
                : `Final files are delivered to the client. ${remaining} final slot${remaining !== 1 ? 's' : ''} remaining.`}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Label</label>
              <input type="text"
                placeholder={fileCategory === 'draft' ? 'e.g. Resume Draft v1' : 'e.g. Final Resume'}
                value={label} onChange={e => setLabel(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B8935B]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Document Type</label>
              <select value={fileType} onChange={e => setFileType(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B8935B]">
                {FILE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">File</label>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
              className="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#FBF8F3] file:text-[#9A7540] hover:file:bg-[#F0EAE0] border border-slate-200 rounded-xl p-1" />
          </div>

          {/* Email notification checkbox */}
          <label className={`flex items-start gap-3 px-3.5 py-3 rounded-xl border cursor-pointer transition-all ${
            sendEmail
              ? 'bg-[#FBF8F3] border-[#E8DDD0]'
              : 'bg-slate-50 border-slate-200 hover:border-slate-300'
          }`}>
            <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)}
              className="mt-0.5 accent-[#B8935B] flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-700">
                Notify client by email after upload
              </p>
              {sendEmail && (
                <p className="text-xs text-[#B8935B] mt-0.5">
                  Will send: <strong>{emailPreview}</strong>
                </p>
              )}
              {!sendEmail && (
                <p className="text-xs text-slate-400 mt-0.5">Client will not be notified</p>
              )}
            </div>
          </label>

          <button onClick={upload} disabled={uploading || !label.trim()}
            className="w-full py-2.5 bg-[#B8935B] text-white text-sm font-bold rounded-xl hover:bg-[#9A7540] disabled:opacity-50 transition-colors">
            {uploading
              ? <span className="flex items-center justify-center gap-2"><Spinner /><span>Uploading...</span></span>
              : `Upload ${fileCategory === 'draft' ? 'Draft' : 'Final Deliverable'}`}
          </button>
        </div>
      </Card>

      {/* Draft files */}
      {drafts.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Drafts ({drafts.length})</p>
          </div>
          <div className="divide-y divide-slate-100">
            {drafts.map(file => <FileRow key={file.id} file={file} clientId={clientId} onDelete={deleteFile} deleting={deleting} />)}
          </div>
        </div>
      )}

      {/* Final files */}
      {finals.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Final Deliverables ({finals.length})</p>
          </div>
          <div className="divide-y divide-slate-100">
            {finals.map(file => <FileRow key={file.id} file={file} clientId={clientId} onDelete={deleteFile} deleting={deleting} />)}
          </div>
        </div>
      )}

      {deliverables.length === 0 && (
        <EmptyCard icon={<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>}
          title="No files uploaded yet" subtitle="Upload draft or final deliverables above. The client will be notified by email." />
      )}
    </div>
  );
}

function FileRow({ file, clientId, onDelete, deleting }: {
  file: Deliverable;
  clientId: string;
  onDelete: (id: string) => void;
  deleting: string | null;
}) {
  return (
    <div className="flex items-center gap-4 p-4">
      <div className="w-10 h-10 rounded-xl bg-[#FBF8F3] border border-[#F0EAE0] flex items-center justify-center flex-shrink-0">
        {file.fileType === 'resume' ? (
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="#B8935B" strokeWidth="2" strokeLinecap="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6M9 13h6M9 17h4"/></svg>
        ) : file.fileType === 'linkedin_banner' ? (
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke="#B8935B" strokeWidth="2"/><circle cx="8.5" cy="8.5" r="1.5" stroke="#B8935B" strokeWidth="2"/><path stroke="#B8935B" strokeWidth="2" strokeLinecap="round" d="M21 15l-5-5L5 21"/></svg>
        ) : file.fileType === 'linkedin_profile_picture' ? (
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" stroke="#B8935B" strokeWidth="2"/><path stroke="#B8935B" strokeWidth="2" strokeLinecap="round" d="M4 20c0-4 3.582-7 8-7s8 3 8 7"/></svg>
        ) : file.fileType === 'cover_letter' ? (
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="#B8935B" strokeWidth="2" strokeLinecap="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
        ) : (
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="#B8935B" strokeWidth="2" strokeLinecap="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-900 text-sm truncate">{file.label}</p>
        <p className="text-xs text-slate-400 mt-0.5 capitalize">
          {file.fileType.replace(/_/g, ' ')} · {fmt(file.createdAt)} · {(file.sizeBytes / 1024).toFixed(0)} KB
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <a href={`/api/career/admin/clients/${clientId}/files/preview?fileId=${file.id}`}
          target="_blank" rel="noopener noreferrer"
          className="px-3 py-1.5 text-xs bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium transition-colors">
          Preview
        </a>
        <a href={`/api/career/admin/clients/${clientId}/files/download?fileId=${file.id}`}
          className="px-3 py-1.5 text-xs bg-[#FBF8F3] text-[#9A7540] rounded-lg hover:bg-[#F0EAE0] font-medium transition-colors">
          Download
        </a>
        <button onClick={() => onDelete(file.id)} disabled={deleting === file.id}
          className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-medium transition-colors disabled:opacity-40">
          {deleting === file.id ? '...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

// ── Emails Tab ────────────────────────────────────────────────────────────────

function EmailsTab({ logs }: { logs: EmailLog[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (logs.length === 0) {
    return <EmptyCard icon={<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>} title="No emails sent yet" subtitle="Email history will appear here once you trigger or send emails." />;
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{logs.length} email{logs.length !== 1 ? 's' : ''} sent</p>
      </div>
      <div className="divide-y divide-slate-100">
        {logs.map(log => (
          <div key={log.id}>
            <button
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
              onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  log.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                }`}>
                  {log.status === 'sent' ? '✓' : '✗'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {TRIGGER_LABELS[log.trigger] ?? log.trigger}
                  </p>
                  <p className="text-xs text-slate-400" title={fmt(log.sentAt, true)}>
                    {relativeTime(log.sentAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  log.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                }`}>
                  {log.status}
                </span>
                <svg className={`w-4 h-4 text-slate-300 transition-transform ${expandedId === log.id ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M19 9l-7 7-7-7"/></svg>
              </div>
            </button>
            {expandedId === log.id && (
              <div className="px-5 pb-4 bg-slate-50 border-t border-slate-100 space-y-2">
                <div className="pt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-slate-400 font-medium uppercase tracking-wide text-[10px] mb-0.5">Trigger</p>
                    <p className="font-semibold text-slate-800">{TRIGGER_LABELS[log.trigger] ?? log.trigger}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium uppercase tracking-wide text-[10px] mb-0.5">Sent</p>
                    <p className="font-semibold text-slate-800">{fmt(log.sentAt, true)}</p>
                  </div>
                </div>
                {log.resendId && (
                  <div>
                    <p className="text-slate-400 font-medium uppercase tracking-wide text-[10px] mb-0.5">Resend ID</p>
                    <a
                      href={`https://resend.com/emails/${log.resendId}`}
                      target="_blank" rel="noopener noreferrer"
                      className="font-mono text-xs text-[#B8935B] hover:underline break-all">
                      {log.resendId}
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Activity Tab ──────────────────────────────────────────────────────────────

const ACTIVITY_STYLE: Record<string, { dot: string; border: string; icon: string }> = {
  status_changed:    { dot: 'bg-[#B8935B]',   border: 'border-l-[#B8935B]',   icon: '→' },
  email_sent_manual: { dot: 'bg-blue-400',     border: 'border-l-blue-400',     icon: '✉' },
  email_sent_auto:   { dot: 'bg-blue-300',     border: 'border-l-blue-300',     icon: '✉' },
  file_uploaded:     { dot: 'bg-emerald-500',  border: 'border-l-emerald-500',  icon: '↑' },
  form_submitted:    { dot: 'bg-purple-500',   border: 'border-l-purple-500',   icon: '✓' },
  revision_created:  { dot: 'bg-amber-500',    border: 'border-l-amber-500',    icon: '↺' },
  revision_actioned: { dot: 'bg-amber-400',    border: 'border-l-amber-400',    icon: '↺' },
  client_created:    { dot: 'bg-[#B8935B]',   border: 'border-l-[#B8935B]',   icon: '★' },
};
const DEFAULT_ACTIVITY_STYLE = { dot: 'bg-slate-300', border: 'border-l-slate-200', icon: '·' };

function ActivityTab({ logs }: { logs: ActivityLog[] }) {
  if (logs.length === 0) {
    return <EmptyCard icon={<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>} title="No activity yet" subtitle="Actions taken on this client will be logged here." />;
  }

  return (
    <div className="space-y-1.5">
      {logs.map(log => {
        const style = ACTIVITY_STYLE[log.action] ?? DEFAULT_ACTIVITY_STYLE;
        return (
          <div key={log.id} className={`flex items-start gap-3 bg-white border border-slate-100 border-l-2 ${style.border} rounded-xl px-4 py-3 shadow-sm`}>
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${style.dot} text-white`}>
              {style.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">
                {ACTION_LABELS[log.action] ?? log.action.replace(/_/g, ' ')}
              </p>
              {log.metadata && Object.keys(log.metadata).length > 0 && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {Object.entries(log.metadata)
                    .filter(([k]) => !['error'].includes(k))
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' · ')}
                </p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-slate-400" title={fmt(log.createdAt, true)}>{relativeTime(log.createdAt)}</p>
              <p className="text-xs text-slate-300">{log.performedBy}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Revision Admin Tab ────────────────────────────────────────────────────────

const REV_STATUS_STYLE: Record<string, string> = {
  PENDING:  'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DENIED:   'bg-red-50 text-red-700 border-red-200',
};

function RevisionAdminTab({ clientId, clientName, clientPackage, services }: {
  clientId: string;
  clientName: string;
  clientPackage: CareerPackage | null;
  services: { slug: string; name: string }[];
}) {
  const [revisions,      setRevisions]      = useState<RevisionItem[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [showForm,       setShowForm]       = useState(false);
  const [note,           setNote]           = useState('');
  const [fileLabel,      setFileLabel]      = useState('');
  const [sendEmail,      setSendEmail]      = useState(true);
  const [countAsClient,  setCountAsClient]  = useState(false);
  const [serviceSlug,    setServiceSlug]    = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const [toast,       setToast]       = useState('');
  // Inline confirm state for approve/deny
  const [confirmId,       setConfirmId]       = useState<string | null>(null);
  const [confirmDecision, setConfirmDecision] = useState<'APPROVED' | 'DENIED' | null>(null);
  const [confirmNote,     setConfirmNote]     = useState('');
  const [confirmEmail,    setConfirmEmail]    = useState(true);
  const [confirming,      setConfirming]      = useState(false);
  const [deletingId,      setDeletingId]      = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    fetch(`/api/career/admin/clients/${clientId}/revisions`)
      .then(r => r.json() as Promise<{ revisions: RevisionItem[] }>)
      .then(d => { setRevisions(d.revisions ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [clientId]);

  const submitRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    const res = await fetch(`/api/career/admin/clients/${clientId}/revisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
      note: note.trim(),
      fileLabel: fileLabel.trim() || undefined,
      sendEmail,
      countAsClient,
      serviceSlug: countAsClient ? (serviceSlug || undefined) : undefined,
    }),
    });
    setSaving(false);
    if (res.ok) {
      const d = await res.json() as { revision: RevisionItem };
      setRevisions(prev => [d.revision, ...prev]);
      setNote(''); setFileLabel(''); setServiceSlug(''); setCountAsClient(false); setShowForm(false);
      showToast(sendEmail ? 'Revision created · email sent' : 'Revision created');
    } else {
      const d = await res.json().catch(() => ({})) as { error?: string };
      setError(d.error ?? 'Failed. Please try again.');
    }
  };

  const confirmAction = async () => {
    if (!confirmId || !confirmDecision) return;
    setConfirming(true);
    const res = await fetch(`/api/career/admin/clients/${clientId}/revisions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        revisionId: confirmId,
        status: confirmDecision,
        adminNote: confirmNote.trim() || undefined,
        sendEmail: confirmEmail,
      }),
    });
    setConfirming(false);
    if (res.ok) {
      const d = await res.json() as { revision: RevisionItem };
      setRevisions(prev => prev.map(r => r.id === confirmId ? d.revision : r));
      const label = confirmDecision === 'APPROVED' ? 'approved' : 'denied';
      showToast(`Revision ${label}${confirmEmail ? ' - email sent' : ''}`);
      setConfirmId(null); setConfirmDecision(null); setConfirmNote('');
    }
  };

  const deleteRevision = async (id: string) => {
    setDeletingId(id);
    const res = await fetch(`/api/career/admin/clients/${clientId}/revisions?revisionId=${id}`, { method: 'DELETE' });
    setDeletingId(null);
    setDeleteConfirmId(null);
    if (res.ok) {
      setRevisions(prev => prev.filter(r => r.id !== id));
      showToast('Revision deleted');
    } else {
      const d = await res.json().catch(() => ({})) as { error?: string };
      showToast(d.error ?? 'Delete failed');
    }
  };

  return (
    <div className="space-y-4">
      {toast && <Toast msg={toast} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-700">Revision Requests</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage revisions for {clientName}. Create a revision from admin or approve/deny client requests.
          </p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="px-4 py-2 text-xs font-bold bg-[#B8935B] text-white rounded-xl hover:bg-[#9A7540] transition-colors">
          + New Revision
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h4 className="text-sm font-bold text-slate-700 mb-4">Create Revision Request</h4>
          <form onSubmit={submitRevision} className="space-y-4">
            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-xl">{error}</p>}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">File / Deliverable (optional)</label>
              <input type="text" value={fileLabel} onChange={e => setFileLabel(e.target.value)}
                placeholder="e.g. Resume v1, LinkedIn Banner"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B8935B] bg-slate-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Revision Instructions *</label>
              <textarea required rows={4} value={note} onChange={e => setNote(e.target.value)}
                placeholder="Describe what needs to be revised…"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B8935B] bg-slate-50 resize-none" />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 accent-[#B8935B]" />
              Send revision email to client ({clientPackage})
            </label>
            {/* Count against client's free limit — use when client asked via chat/call */}
            <div className="border border-amber-200 bg-amber-50 rounded-xl p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-amber-800 cursor-pointer">
                <input type="checkbox" checked={countAsClient} onChange={e => { setCountAsClient(e.target.checked); if (!e.target.checked) setServiceSlug(''); }}
                  className="w-4 h-4 rounded border-amber-300 accent-amber-600" />
                Count against client&apos;s free revision limit
              </label>
              <p className="text-xs text-amber-600 pl-6">Use when the client requested this via chat or call — prevents them from bypassing the 2-revision cap.</p>
              {countAsClient && services.length > 0 && (
                <div className="pl-6">
                  <label className="block text-xs font-semibold text-amber-700 mb-1">Which service? *</label>
                  <select required value={serviceSlug} onChange={e => setServiceSlug(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white">
                    <option value="">Select service…</option>
                    {services.map(s => (
                      <option key={s.slug} value={s.slug}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving || note.trim().length < 5 || (countAsClient && services.length > 0 && !serviceSlug)}
                className="px-5 py-2 bg-[#B8935B] text-white text-sm font-bold rounded-xl hover:bg-[#9A7540] disabled:opacity-50 transition-colors flex items-center gap-2">
                {saving && <Spinner />}
                {saving ? 'Creating…' : 'Create Revision'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Revision list */}
      {loading ? (
        <div className="space-y-3">
          {[1,2].map(i => <div key={i} className="h-24 bg-slate-200 rounded-2xl animate-pulse" />)}
        </div>
      ) : revisions.length === 0 ? (
        <EmptyCard icon="🔄" title="No revision requests" subtitle="Create one above or wait for the client to submit a request." />
      ) : (
        <div className="space-y-3">
          {revisions.map(r => (
            <div key={r.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${REV_STATUS_STYLE[r.status] ?? REV_STATUS_STYLE.PENDING}`}>
                      {r.status}
                    </span>
                    <span className="text-xs text-slate-400">
                      by {r.requestedBy === 'admin' ? 'Admin' : 'Client'} · {fmt(r.createdAt)}
                    </span>
                  </div>
                  {r.fileLabel && <p className="text-xs font-semibold text-slate-500 mb-1">Re: {r.fileLabel}</p>}
                  <p className="text-sm text-slate-800 leading-relaxed">{r.note}</p>
                  {r.adminNote && (
                    <div className="mt-2 px-3 py-2 bg-[#FBF8F3] border border-[#F0EAE0] rounded-lg">
                      <p className="text-xs text-[#9A7540]"><strong>Admin note:</strong> {r.adminNote}</p>
                    </div>
                  )}
                </div>
                {/* Delete button */}
                <div className="flex-shrink-0">
                  {deleteConfirmId === r.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => deleteRevision(r.id)} disabled={deletingId === r.id}
                        className="px-2 py-1 text-[11px] font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
                        {deletingId === r.id ? '…' : 'Delete'}
                      </button>
                      <button onClick={() => setDeleteConfirmId(null)}
                        className="px-2 py-1 text-[11px] font-semibold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                        No
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirmId(r.id)} title="Delete revision"
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                        <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              {r.status === 'PENDING' && (
                <div className="pt-3 border-t border-slate-100">
                  {confirmId === r.id && confirmDecision ? (
                    <div className="space-y-2">
                      <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        confirmDecision === 'APPROVED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {confirmDecision === 'APPROVED' ? 'Approving revision' : 'Denying revision'}
                        {confirmEmail && ` - email will be sent to ${clientName.split(' ')[0]}`}
                      </div>
                      <textarea rows={2} value={confirmNote} onChange={e => setConfirmNote(e.target.value)}
                        placeholder={confirmDecision === 'DENIED' ? 'Reason for denial (recommended)…' : 'Optional note to client…'}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B8935B] bg-slate-50 resize-none" />
                      <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                        <input type="checkbox" checked={confirmEmail} onChange={e => setConfirmEmail(e.target.checked)}
                          className="w-4 h-4 accent-[#B8935B]"/>
                        Send email to client
                      </label>
                      <div className="flex gap-2">
                        <button onClick={confirmAction} disabled={confirming}
                          className={`flex-1 py-2 text-xs font-bold rounded-xl disabled:opacity-50 transition-colors ${
                            confirmDecision === 'APPROVED'
                              ? 'text-white bg-emerald-600 hover:bg-emerald-700'
                              : 'text-white bg-red-600 hover:bg-red-700'
                          }`}>
                          {confirming ? 'Saving…' : `Confirm ${confirmDecision === 'APPROVED' ? 'Approve' : 'Deny'}`}
                        </button>
                        <button onClick={() => { setConfirmId(null); setConfirmDecision(null); setConfirmNote(''); }}
                          className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setConfirmId(r.id); setConfirmDecision('APPROVED'); setConfirmNote(''); setConfirmEmail(true); }}
                        className="flex-1 py-1.5 text-xs font-bold text-emerald-700 border border-emerald-200 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors">
                        Approve
                      </button>
                      <button
                        onClick={() => { setConfirmId(r.id); setConfirmDecision('DENIED'); setConfirmNote(''); setConfirmEmail(true); }}
                        className="flex-1 py-1.5 text-xs font-bold text-red-700 border border-red-200 bg-red-50 rounded-xl hover:bg-red-100 transition-colors">
                        Deny
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Comments Admin Tab ────────────────────────────────────────────────────────

interface Attachment { name: string; url: string; mimeType: string; size: number; }

interface CommentItem {
  id: string;
  authorType: string;
  authorName: string;
  content: string;
  attachments: Attachment[] | null;
  readByAdmin: boolean;
  readByClient: boolean;
  readByAdminAt: string | null;
  readByClientAt: string | null;
  createdAt: string;
  editedAt: string | null;
  isDeleted: boolean;
  isInternalOnly?: boolean;
}

function AttachmentChip({ a, onRemove }: { a: Attachment; onRemove?: () => void }) {
  const isImage = a.mimeType.startsWith('image/');
  const ext = a.name.split('.').pop()?.toUpperCase() ?? 'FILE';
  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium
      ${isImage ? 'bg-[#FBF8F3] border-[#E8DDD0] text-[#9A7540]' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.url} alt={a.name} className="w-6 h-6 rounded object-cover flex-shrink-0" />
      ) : (
        <span className="w-6 h-5 flex items-center justify-center bg-slate-200 rounded text-[9px] font-bold text-slate-500 flex-shrink-0">{ext}</span>
      )}
      <a href={a.url} target="_blank" rel="noopener noreferrer" className="max-w-[120px] truncate hover:underline">{a.name}</a>
      {onRemove && (
        <button type="button" onClick={onRemove} className="ml-0.5 text-slate-400 hover:text-red-500 transition-colors leading-none">×</button>
      )}
    </div>
  );
}

function MessageBubble({ c, isAdmin, showHeader = true, onEdit, onDelete }: {
  c: CommentItem; isAdmin: boolean; showHeader?: boolean;
  onEdit?: (id: string, currentContent: string) => void;
  onDelete?: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const mine = isAdmin ? c.authorType === 'admin' : c.authorType === 'client';
  const seenAt = mine ? (isAdmin ? c.readByClientAt : c.readByAdminAt) : null;
  const atts = c.attachments ?? [];

  return (
    <div className={`group flex gap-4 ${!showHeader ? 'mt-1' : 'mt-5'} ${c.isInternalOnly ? 'bg-yellow-50/50 p-2 rounded-xl border border-yellow-200/50 -mx-2' : ''}`}>
      {/* Avatar column */}
      <div className="w-10 flex-shrink-0 flex justify-center">
        {showHeader ? (
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold shadow-sm ${
            c.authorType === 'admin' ? (c.isInternalOnly ? 'bg-yellow-500 text-white' : 'bg-[#B8935B] text-white') : 'bg-slate-200 text-slate-700'
          }`}>
            {c.authorType === 'admin' ? 'C' : c.authorName[0]?.toUpperCase() ?? '?'}
          </div>
        ) : (
          <div className="w-10 opacity-0 group-hover:opacity-100 flex justify-center items-center text-[10px] text-slate-400 font-medium select-none">
             {new Date(c.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </div>
        )}
      </div>
      
      {/* Content column */}
      <div className="flex-1 min-w-0 pb-0.5">
        {showHeader && (
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-bold text-slate-900">{c.authorType === 'admin' ? 'Catalyst Team' : c.authorName}</span>
            <span className="text-xs font-medium text-slate-400">{fmt(c.createdAt, true)}</span>
            {c.isInternalOnly && <span className="text-[10px] font-bold text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded ml-2">INTERNAL</span>}
            {c.editedAt && <span className="text-[10px] text-slate-400 italic">(edited)</span>}
          </div>
        )}
        {/* Bubble content */}
        {c.isDeleted ? (
          <div className="flex items-center gap-1.5 text-slate-400 italic text-sm">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
            </svg>
            This message was deleted
          </div>
        ) : (c.content || atts.length === 0) && (
          <div className="relative group/msg">
            <div className="text-body text-slate-700 leading-relaxed whitespace-pre-wrap break-words [word-break:break-word]">
              {c.content}
            </div>
            {(mine || isAdmin) && (onEdit || onDelete) && (
              <div className="absolute -top-1 -right-1 opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-0.5">
                {mine && onEdit && (
                  <button onClick={() => onEdit(c.id, c.content)}
                    className="p-1 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300 shadow-sm" title="Edit">
                    <svg width="11" height="11" fill="none" viewBox="0 0 24 24">
                      <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                )}
                {onDelete && !confirmDelete && (
                  <button onClick={() => setConfirmDelete(true)}
                    className="p-1 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 shadow-sm" title="Delete">
                    <svg width="11" height="11" fill="none" viewBox="0 0 24 24">
                      <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                    </svg>
                  </button>
                )}
              </div>
            )}
            {confirmDelete && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="text-red-600 font-medium">Delete for everyone?</span>
                <button onClick={() => { onDelete?.(c.id); setConfirmDelete(false); }}
                  className="px-2 py-0.5 bg-red-500 text-white rounded font-bold hover:bg-red-600 transition-colors">Delete</button>
                <button onClick={() => setConfirmDelete(false)}
                  className="px-2 py-0.5 text-slate-500 hover:text-slate-800 transition-colors">Cancel</button>
              </div>
            )}
          </div>
        )}
        {/* Attachments */}
        {atts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {atts.map((a, i) => {
              const isImg = a.mimeType.startsWith('image/');
              const ext = a.name.split('.').pop()?.toUpperCase() ?? 'FILE';
              return isImg ? (
                <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                  className="block rounded-xl overflow-hidden border border-slate-200 hover:opacity-90 transition-opacity">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url} alt={a.name} className="max-h-40 max-w-[220px] object-cover" />
                </a>
              ) : (
                <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                  <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-500">{ext}</span>
                  <span className="max-w-[140px] truncate">{a.name}</span>
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" className="text-slate-400 flex-shrink-0">
                    <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                  </svg>
                </a>
              );
            })}
          </div>
        )}
        {/* Meta: time + read receipt */}
        {mine && (
          <div className="flex items-center gap-2 mt-1">
            {seenAt ? (
              <span className="text-[10px] text-[#B8935B] font-medium flex items-center gap-0.5">
                <svg width="10" height="10" fill="none" viewBox="0 0 24 24">
                  <path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2.5"/>
                </svg>
                Seen {fmt(seenAt, true)}
              </span>
            ) : (
              <span className="text-[10px] text-slate-300 font-medium">Delivered</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CommentsAdminTab({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [comments,     setComments]     = useState<CommentItem[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [reply,        setReply]        = useState('');
  const [posting,      setPosting]      = useState(false);
  const [error,        setError]        = useState('');
  const [pendingFiles, setPendingFiles] = useState<Attachment[]>([]);
  const [uploading,    setUploading]    = useState(false);
  const [isInternalOnly, setIsInternalOnly] = useState(false);
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editContent,  setEditContent]  = useState('');
  const [saving,       setSaving]       = useState(false);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const threadRef     = useRef<HTMLDivElement>(null);
  const replyRef      = useRef<HTMLTextAreaElement>(null);
  const editRef       = useRef<HTMLTextAreaElement>(null);

  const load = () => {
    fetch(`/api/career/admin/clients/${clientId}/comments`)
      .then(r => r.json() as Promise<{ comments: CommentItem[] }>)
      .then(d => { setComments(d.comments ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [comments]);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (pendingFiles.length + files.length > 3) {
      setError('Max 3 attachments per message.'); return;
    }
    setUploading(true); setError('');
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/career/admin/clients/${clientId}/upload`, { method: 'POST', body: form });
      if (res.ok) {
        const att = await res.json() as Attachment;
        setPendingFiles(prev => [...prev, att]);
      } else {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setError(d.error ?? 'Upload failed.');
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const postReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim() && pendingFiles.length === 0) return;
    setPosting(true); setError('');
    const res = await fetch(`/api/career/admin/clients/${clientId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: reply.trim(), attachments: pendingFiles, isInternalOnly }),
    });
    if (res.ok) {
      const d = await res.json() as { comment: CommentItem };
      setComments(prev => [...prev, d.comment]);
      setReply(''); setPendingFiles([]); setIsInternalOnly(false);
    } else {
      const d = await res.json().catch(() => ({})) as { error?: string };
      setError(d.error ?? 'Failed to send message.');
    }
    setPosting(false);
  };

  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  const startEdit = (id: string, content: string) => {
    setEditingId(id);
    setEditContent(content);
    setTimeout(() => { if (editRef.current) { autoResize(editRef.current); editRef.current.focus(); } }, 0);
  };

  const cancelEdit = () => { setEditingId(null); setEditContent(''); };

  const deleteComment = async (id: string) => {
    const res = await fetch(`/api/career/admin/clients/${clientId}/comments`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId: id }),
    });
    if (res.ok) {
      const d = await res.json() as { comment: CommentItem };
      setComments(prev => prev.map(c => c.id === id ? d.comment : c));
    }
  };

  const saveEdit = async () => {
    if (!editingId || !editContent.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/career/admin/clients/${clientId}/comments`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId: editingId, content: editContent.trim() }),
    });
    if (res.ok) {
      const d = await res.json() as { comment: CommentItem };
      setComments(prev => prev.map(c => c.id === editingId ? d.comment : c));
      cancelEdit();
    }
    setSaving(false);
  };

  const unreadCount = comments.filter(c => c.authorType === 'client' && !c.readByAdmin).length;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800">Messages</h3>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full leading-none">
                {unreadCount} new
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Conversation with {clientName}</p>
        </div>
        {!loading && (
          <span className="text-xs text-slate-400">{comments.length} message{comments.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Thread */}
      <div ref={threadRef} className="p-5 space-y-4 max-h-[520px] overflow-y-auto">
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                <path stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
              </svg>
            </div>
            <p className="text-sm text-slate-500 font-medium">No messages yet</p>
            <p className="text-xs text-slate-400 mt-1">Start the conversation below.</p>
          </div>
        ) : (
          comments.map((c, i) => {
            const prev = comments[i - 1];
            const isSameAuthor = prev && prev.authorType === c.authorType && prev.authorName === c.authorName && prev.isInternalOnly === c.isInternalOnly;
            const isCloseInTime = prev && (new Date(c.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000);
            const showHeader = !(isSameAuthor && isCloseInTime);
            if (editingId === c.id) {
              return (
                <div key={c.id} className="mt-5 flex gap-4">
                  <div className="w-10 flex-shrink-0">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold bg-[#B8935B] text-white shadow-sm">C</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <textarea
                      ref={editRef}
                      value={editContent}
                      onChange={e => { setEditContent(e.target.value); autoResize(e.target); }}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { void saveEdit(); } if (e.key === 'Escape') cancelEdit(); }}
                      className="w-full px-3.5 py-2.5 text-sm border border-[#B8935B] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B8935B]/30 bg-white resize-none leading-relaxed overflow-hidden"
                      style={{ minHeight: '2.5rem' }}
                    />
                    <div className="flex items-center gap-2 mt-1.5">
                      <button onClick={saveEdit} disabled={saving || !editContent.trim()} className="px-3 py-1 bg-[#B8935B] text-white text-xs font-bold rounded-lg hover:bg-[#9A7540] disabled:opacity-50 transition-colors">
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button onClick={cancelEdit} className="px-3 py-1 text-xs text-slate-500 hover:text-slate-800 transition-colors">Cancel</button>
                      <span className="text-[10px] text-slate-300">Ctrl+Enter to save · Esc to cancel</span>
                    </div>
                  </div>
                </div>
              );
            }
            return <MessageBubble key={c.id} c={c} isAdmin={true} showHeader={showHeader} onEdit={startEdit} onDelete={deleteComment} />;
          })
        )}
      </div>

      {/* Pending attachments preview */}
      {pendingFiles.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {pendingFiles.map((a, i) => (
            <AttachmentChip key={i} a={a} onRemove={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))} />
          ))}
        </div>
      )}

      {/* Compose */}
      <div className="border-t border-slate-100 p-4">
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        <form onSubmit={postReply} className="flex flex-col gap-2">
          <textarea
            ref={replyRef}
            value={reply}
            onChange={e => { setReply(e.target.value); autoResize(e.target); }}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { void postReply(e as unknown as React.FormEvent); } }}
            placeholder={`Message ${clientName}… (Ctrl+Enter to send)`}
            rows={2}
            className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B8935B] bg-slate-50 resize-none leading-relaxed overflow-hidden"
            style={{ minHeight: '2.5rem' }}
          />
          <div className="flex items-center justify-between gap-2">
            {/* Attach button */}
            <div className="flex items-center gap-2">
              <button type="button" disabled={uploading || pendingFiles.length >= 3}
                onClick={() => fileInputRef.current?.click()}
                title="Attach file (PNG, JPG, PDF, DOCX — max 10 MB)"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40 transition-colors">
                {uploading ? (
                  <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                  </svg>
                )}
                {uploading ? 'Uploading…' : 'Attach'}
              </button>
              {pendingFiles.length > 0 && (
                <span className="text-xs text-slate-400">{pendingFiles.length}/3 file{pendingFiles.length !== 1 ? 's' : ''}</span>
              )}
              <label className="flex items-center gap-1.5 ml-2 text-xs font-medium text-slate-500 cursor-pointer">
                <input type="checkbox" checked={isInternalOnly} onChange={e => setIsInternalOnly(e.target.checked)} className="w-3.5 h-3.5 accent-yellow-500" />
                <span className={isInternalOnly ? 'text-yellow-600' : ''}>Internal Note (hidden)</span>
              </label>
            </div>
            <button type="submit" disabled={posting || uploading || (!reply.trim() && pendingFiles.length === 0)}
              className="px-5 py-2 bg-[#B8935B] text-white text-sm font-bold rounded-xl hover:bg-[#9A7540] disabled:opacity-50 transition-colors flex items-center gap-1.5">
              {posting ? <Spinner /> : (
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                  <path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                </svg>
              )}
              {posting ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
        <input ref={fileInputRef} type="file" className="hidden" multiple accept=".png,.jpg,.jpeg,.webp,.pdf,.docx,.doc"
          onChange={e => void handleFileSelect(e.target.files)} />
        <p className="text-[10px] text-slate-300 mt-2">PNG · JPG · PDF · DOCX · max 10 MB · max 3 per message</p>
      </div>
    </div>
  );
}

// ── Upgrade Invoices Tab ──────────────────────────────────────────────────────

type UpgradeInvoice = {
  id: string;
  invoiceNumber: string;
  notes: string | null;
  totalPayable: number;
  currency: string;
  currencySymbol: string;
  status: string;
  razorpayLinkUrl: string | null;
  razorpayPaymentId: string | null;
  invoiceDate: string;
  dueDate: string;
  paidAt: string | null;
};

function UpgradeInvoicesTab({ clientId }: { clientId: string }) {
  const [invoices, setInvoices] = useState<UpgradeInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/career/admin/clients/${clientId}/upgrade-invoices`)
      .then(r => r.json())
      .then(d => { setInvoices(d.invoices ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [clientId]);

  const statusColor = (s: string, dueDate: string) => {
    if (s === 'PAID') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (s === 'CANCELLED') return 'bg-slate-100 text-slate-500 border-slate-200';
    if (new Date(dueDate) < new Date()) return 'bg-red-50 text-red-600 border-red-100';
    return 'bg-amber-50 text-amber-700 border-amber-100';
  };

  const statusLabel = (s: string, dueDate: string) => {
    if (s === 'PAID') return 'Paid';
    if (s === 'CANCELLED') return 'Cancelled';
    if (new Date(dueDate) < new Date()) return 'Expired';
    return 'Pending';
  };

  if (loading) return <div className="py-12 text-center text-sm text-slate-400">Loading invoices…</div>;

  if (invoices.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-slate-400 text-sm">No upgrade invoices found.</p>
        <p className="text-slate-300 text-xs mt-1">Auto-generated upgrade invoices appear here when the client initiates an upgrade from the portal.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        These invoices are created automatically when a client initiates an upgrade from the client portal. No manual action needed — Razorpay handles payment collection.
      </p>
      {invoices.map(inv => {
        const label = statusLabel(inv.status, inv.dueDate);
        const colorClass = statusColor(inv.status, inv.dueDate);
        const target = inv.notes?.match(/Target:\s*(\S+)/)?.[1] ?? '—';
        return (
          <div key={inv.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-slate-800">{inv.invoiceNumber}</span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${colorClass}`}>{label}</span>
                </div>
                <p className="text-xs text-slate-500">
                  Upgrade target: <span className="font-medium text-slate-700">{target === 'FULL_PACKAGE' ? 'Career Booster Package' : target === 'PREMIUM_PLUS' ? 'Premium Plus Package' : target}</span>
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Created {new Date(inv.invoiceDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {' · '}Due {new Date(inv.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {inv.paidAt && <span className="text-emerald-600"> · Paid {new Date(inv.paidAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-lg font-bold text-slate-900">{inv.currencySymbol}{inv.totalPayable.toLocaleString('en-IN')}</p>
                <p className="text-[11px] text-slate-400">{inv.currency}</p>
              </div>
            </div>
            {inv.razorpayLinkUrl && inv.status !== 'PAID' && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-3">
                <a href={inv.razorpayLinkUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#B8935B] hover:underline">
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                  Open Razorpay Link
                </a>
                <button
                  onClick={() => { void navigator.clipboard.writeText(inv.razorpayLinkUrl!); }}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                  Copy link
                </button>
              </div>
            )}
            {inv.razorpayPaymentId && (
              <p className="text-[11px] text-slate-400 mt-2">Payment ID: <span className="font-mono">{inv.razorpayPaymentId}</span></p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function FormDataViewer({ data, compact = false, clientId }: { data: Record<string, unknown>; compact?: boolean; clientId: string }) {
  return (
    <div className={`space-y-${compact ? '2' : '3'}`}>
      {Object.entries(data).map(([key, value]) => {
        if (value === null || value === undefined || value === '') return null;
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const isFile = typeof value === 'object' && value !== null && 'name' in value && !Array.isArray(value);
        const isArray = Array.isArray(value);
        const fileObj = isFile ? (value as { name: string; size?: number; dataUrl?: string; submissionId?: string; fieldKey?: string }) : null;
        const strVal = isFile
          ? fileObj!.name
          : isArray
            ? (value as string[]).join(', ')
            : String(value);
        const isLong = strVal.length > 80;
        const isImage = fileObj?.dataUrl?.startsWith('data:image/');
        return (
          <div key={key} className={compact ? 'text-xs' : 'text-sm'}>
            <dt className={`font-semibold text-slate-500 ${compact ? 'text-xs' : 'text-xs'} uppercase tracking-wide mb-0.5`}>
              {label}
            </dt>
            {isFile ? (
              <dd>
                {fileObj?.submissionId && fileObj?.fieldKey ? (
                  <a
                    href={`/api/career/admin/clients/${clientId}/form-files?submissionId=${fileObj.submissionId}&fieldKey=${fileObj.fieldKey}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[#B8935B] hover:text-[#7A5B2E] hover:underline font-medium"
                  >
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                    Download {strVal}
                    <span className="text-xs text-slate-400 font-normal">
                      {fileObj.size ? `(${(fileObj.size / 1024).toFixed(0)} KB)` : ''}
                    </span>
                  </a>
                ) : (
                  <span className="text-slate-400 italic flex items-center gap-1">
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                    <span className="font-medium">{strVal} (File data stripped)</span>
                  </span>
                )}
              </dd>
            ) : isArray ? (
              <dd className="flex flex-wrap gap-1">
                {(value as string[]).map(tag => (
                  <span key={tag} className="px-2 py-0.5 bg-[#F0EAE0] text-[#7A5B2E] text-xs rounded-full font-medium">
                    {tag}
                  </span>
                ))}
              </dd>
            ) : isLong ? (
              <dd className="text-slate-700 bg-slate-50 rounded-lg p-2.5 text-xs leading-relaxed whitespace-pre-wrap border border-slate-100">
                {strVal}
              </dd>
            ) : (
              <dd className="text-slate-800 font-medium">{strVal}</dd>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">
        <span className="text-[#B8935B] flex-shrink-0">{icon}</span>{title}
      </h3>
      {children}
    </div>
  );
}

function CountBadge({ n }: { n: number }) {
  return (
    <span className="ml-1.5 px-1.5 py-0.5 bg-[#B8935B] text-white text-xs font-bold rounded-full leading-none">
      {n}
    </span>
  );
}

function EmptyCard({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center">
      <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-400">
        {icon}
      </div>
      <p className="text-slate-700 font-semibold text-sm">{title}</p>
      {subtitle && <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto">{subtitle}</p>}
    </div>
  );
}

function Toast({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-medium">
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      {msg}
    </div>
  );
}

function Spinner() {
  return <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />;
}

function PageSkeleton() {
  return (
    <div className="p-7 max-w-5xl mx-auto space-y-5 animate-pulse">
      <div className="h-4 w-48 bg-slate-200 rounded" />
      <div className="h-40 bg-slate-200 rounded-2xl" />
      <div className="h-10 bg-slate-200 rounded-xl" />
      <div className="grid grid-cols-2 gap-5">
        <div className="h-64 bg-slate-200 rounded-2xl" />
        <div className="h-64 bg-slate-200 rounded-2xl" />
      </div>
    </div>
  );
}

function fmt(dateStr: string, includeTime = false): string {
  const d = new Date(dateStr);
  const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  if (!includeTime) return date;
  return `${date}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}

// ── Edit Client Modal ─────────────────────────────────────────────────────────

function EditClientModal({
  client, onClose, onSaved,
}: {
  client: ClientDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name:          client.name,
    email:         client.email,
    phone:         client.phone ?? '',
    packageType:   client.packageType as CareerPackage,
    amountPaid:    String(client.amountPaid),
    currency:      client.currency,
    notes:         client.notes ?? '',
    invoiceNumber: client.invoice?.invoiceNumber ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    const res = await fetch(`/api/career/admin/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:          form.name,
        email:         form.email,
        phone:         form.phone,
        packageType:   form.packageType,
        amountPaid:    Number(form.amountPaid),
        currency:      form.currency,
        notes:         form.notes,
        invoiceNumber: form.invoiceNumber,
      }),
    });
    if (res.ok) { onSaved(); return; }
    const d = await res.json().catch(() => ({})) as { error?: string };
    setError(d.error ?? 'Save failed. Please try again.');
    setSaving(false);
  };

  const packages: CareerPackage[] = ['RESUME', 'LINKEDIN', 'COVER_LETTER', 'FULL'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Edit Client</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">{error}</div>}

          {[
            { id: 'name',  label: 'Full Name',     type: 'text',  required: true  },
            { id: 'email', label: 'Email Address',  type: 'email', required: true  },
            { id: 'phone', label: 'Phone Number',   type: 'tel',   required: false },
          ].map(({ id, label, type, required }) => (
            <div key={id}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
              <input type={type} required={required} value={(form as Record<string, string>)[id]} onChange={set(id)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B8935B] bg-slate-50" />
            </div>
          ))}

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Package</label>
            <select value={form.packageType} onChange={set('packageType')}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B8935B] bg-slate-50">
              {packages.map(p => <option key={p} value={p}>{PACKAGE_LABELS[p]}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Amount Paid</label>
              <input type="number" min="0" step="0.01" value={form.amountPaid} onChange={set('amountPaid')}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B8935B] bg-slate-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Currency</label>
              <input type="text" maxLength={3} value={form.currency} onChange={set('currency')}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B8935B] bg-slate-50 uppercase" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Linked Invoice <span className="normal-case font-normal text-slate-400">(invoice number — links revenue to portal invoice)</span>
            </label>
            <input
              type="text"
              value={form.invoiceNumber}
              onChange={set('invoiceNumber')}
              placeholder="e.g. RN-2604-6695 — leave blank to unlink"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B8935B] bg-slate-50 font-mono"
            />
            {client.invoice && (
              <p className="mt-1 text-xs text-emerald-600">
                Currently linked: {client.invoice.invoiceNumber} · {client.invoice.currency} {client.invoice.totalPayable} · {client.invoice.status}
              </p>
            )}
            {!client.invoice && client.invoiceId && (
              <p className="mt-1 text-xs text-amber-600">Linked by ID (no number loaded) — type the number to re-link</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Internal Notes</label>
            <textarea rows={3} value={form.notes} onChange={set('notes')}
              placeholder="Optional admin notes…"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B8935B] bg-slate-50 resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 py-2.5 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 text-sm font-bold text-white bg-[#B8935B] rounded-xl hover:bg-[#9A7540] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
