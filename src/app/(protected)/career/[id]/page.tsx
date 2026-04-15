'use client';
// src/app/(protected)/career/[id]/page.tsx

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PACKAGE_LABELS, SERVICE_LABELS, STATUS_LABELS } from '@/lib/career/types';
import type { CareerStatus, CareerPackage, CareerServiceSlug, EmailTrigger } from '@/lib/career/types';

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
  amountPaid: number; currency: string; notes: string | null;
  createdAt: string; lastLoginAt: string | null; invoiceId: string | null;
  forms: FormSubmission[];
  deliverables: Deliverable[];
  emailLogs: EmailLog[];
  activityLogs: ActivityLog[];
  services: { slug: string; name: string }[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: CareerStatus[] = [
  'NOT_STARTED','SUBMITTED','UNDER_PROCESS','DRAFT_SENT','REVISION_REQUESTED','COMPLETED',
];
const STATUS_STYLES: Record<CareerStatus, { bg: string; text: string; dot: string }> = {
  NOT_STARTED:        { bg: 'bg-slate-100',   text: 'text-slate-600',  dot: 'bg-slate-400'   },
  SUBMITTED:          { bg: 'bg-blue-100',    text: 'text-blue-700',   dot: 'bg-blue-500'    },
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

type Tab = 'overview' | 'forms' | 'files' | 'emails' | 'activity' | 'revisions' | 'comments';

// ── Main Component ────────────────────────────────────────────────────────────

export default function CareerClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showEdit,    setShowEdit]    = useState(false);
  const [showDelete,  setShowDelete]  = useState(false);
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
      <Link href="/career" className="mt-3 inline-block text-blue-600 text-sm hover:underline">← Back to Career Booster Services</Link>
    </div>
  );

  const s = STATUS_STYLES[client.status];

  return (
    <div className="p-5 md:p-7 max-w-5xl mx-auto space-y-5">

      {/* Breadcrumb + action buttons */}
      <div className="flex items-center justify-between gap-3">
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/career" className="text-slate-400 hover:text-blue-600 transition-colors">Career Booster Services</Link>
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

      {/* Hero card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-blue-600 via-blue-500 to-emerald-400" />
        <div className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            {/* Left: identity */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                {client.name[0]?.toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">{client.name}</h1>
                <p className="text-slate-500 text-sm">{client.email}</p>
                {client.phone && <p className="text-slate-400 text-xs mt-0.5">{client.phone}</p>}
              </div>
            </div>
            {/* Right: badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full border border-blue-200 uppercase tracking-wide">
                {client.services?.length > 0
                  ? client.services.map(s => SERVICE_LABELS[s.slug as CareerServiceSlug] ?? s.name).join(', ')
                  : client.packageType ? PACKAGE_LABELS[client.packageType] : 'Career Services'}
              </span>
              <span className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full ${s.bg} ${s.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                {STATUS_LABELS[client.status]}
              </span>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Amount Paid',  value: `${client.currency} ${client.amountPaid.toLocaleString()}` },
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
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
        {(['overview','forms','files','emails','activity','revisions','comments'] as Tab[]).map(tab => (
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
        <OverviewTab client={client} onUpdated={reload} />
      )}

      {/* ── FORMS ── */}
      {activeTab === 'forms' && (
        <FormsTab forms={client.forms} packageType={client.packageType ?? null} />
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
        <RevisionAdminTab clientId={client.id} clientName={client.name} clientPackage={client.packageType ?? null} />
      )}

      {/* ── COMMENTS ── */}
      {activeTab === 'comments' && (
        <CommentsAdminTab clientId={client.id} clientName={client.name} />
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
                      <strong>info@theripplenexus.com</strong>. Enter it to confirm deletion.
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
                    <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 mb-4">
                      OTP sent to <strong>info@theripplenexus.com</strong>. It expires in 10 minutes.
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

function OverviewTab({ client, onUpdated }: { client: ClientDetail; onUpdated: () => void }) {
  const [statusLoading,   setStatusLoading]   = useState(false);
  const [pendingStatus,   setPendingStatus]   = useState<CareerStatus | null>(null);
  const [emailSending,    setEmailSending]    = useState(false);
  const [toast,           setToast]           = useState('');

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
    setPendingStatus(null);
    const res = await fetch(`/api/career/admin/clients/${client.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: pendingStatus }),
    });
    const d = await res.json() as { statusLabel?: string; emailTriggered?: boolean; emailTrigger?: string };
    setStatusLoading(false);
    if (res.ok) {
      const autoLabel = d.emailTrigger
        ? clientTriggers.find(t => t.value === d.emailTrigger)?.label
          ?? EMAIL_TRIGGERS.find(t => t.value === d.emailTrigger)?.label
        : null;
      showToast(autoLabel
        ? `Status updated to "${d.statusLabel}" - "${autoLabel}" email sent automatically`
        : `Status updated to "${d.statusLabel}"`);
      onUpdated();
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
              <div className="mt-3 flex items-start gap-2.5 px-3.5 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
                <svg className="mt-0.5 flex-shrink-0" width="14" height="14" fill="none" viewBox="0 0 24 24">
                  <path stroke="#1f56d4" strokeWidth="2" strokeLinecap="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                <p className="text-xs text-blue-700 leading-relaxed">
                  <strong>"{autoEmailForStatus[pendingStatus]!.label}"</strong> email will be sent to{' '}
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
                className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50">
                {statusLoading ? 'Updating...' : 'Yes, Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status control */}
      <Card title="Update Status" icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>}>
        <div className="space-y-1.5">
          {STATUS_OPTIONS.map(s => {
            const style   = STATUS_STYLES[s];
            const isCurrent = s === client.status;
            const autoEmail = autoEmailForStatus[s];
            return (
              <button key={s} disabled={statusLoading || isCurrent}
                onClick={() => setPendingStatus(s)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                  isCurrent
                    ? `${style.bg} ${style.text} border-transparent cursor-default`
                    : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-600 hover:text-blue-700'
                } disabled:opacity-60`}>
                <span className="flex items-center gap-2.5">
                  <span className={`w-2 h-2 rounded-full ${isCurrent ? style.dot : 'bg-slate-300'}`} />
                  {STATUS_LABELS[s]}
                </span>
                <span className="flex items-center gap-2">
                  {autoEmail && !isCurrent && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-200 rounded font-semibold whitespace-nowrap">
                      Sends: {autoEmail.label}
                    </span>
                  )}
                  {isCurrent && <span className="text-xs opacity-60 font-normal">Current</span>}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Email trigger */}
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
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}>
                      <input type="radio" name="trigger" value={t.value}
                        checked={selectedTrigger === t.value}
                        onChange={() => { setSelectedTrigger(t.value); setActioningId(null); setActionNote(''); }}
                        className="mt-1 accent-blue-600 flex-shrink-0" />
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
                                      <p className="text-xs font-bold text-blue-700 mb-0.5">Re: {r.fileLabel}</p>
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
                                      className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                                    />
                                    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                                      <input type="checkbox" checked={actionEmailOn} onChange={e => setActionEmailOn(e.target.checked)}
                                        className="accent-blue-600" />
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
              Client will receive: <strong>"Your {draftEmailLabel} draft is ready"</strong>
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

      {/* Portal link */}
      <Card title="Client Portal" icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>}>
        <p className="text-sm text-slate-500 mb-3">
          Share this link with the client. They can login via magic link request on this page.
        </p>
        <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <code className="text-xs text-slate-600 flex-1 truncate">
            {`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/portal/login`}
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
    </div>
  );
}

// ── Forms Tab ─────────────────────────────────────────────────────────────────

function FormsTab({ forms, packageType }: { forms: FormSubmission[]; packageType: CareerPackage | null }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (forms.length === 0) {
    return (
      <EmptyCard icon={<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>}
        title="No forms submitted yet"
        subtitle="The client hasn't filled in their details. Trigger a Welcome email to remind them." />
    );
  }

  // Group by formType, show latest version per type prominently
  const byType = forms.reduce<Record<string, FormSubmission[]>>((acc, f) => {
    (acc[f.formType] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(byType).map(([type, submissions]) => {
        const latest = submissions[0]; // already ordered desc by version
        const isOpen = expanded === type;
        return (
          <div key={type} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {/* Header */}
            <button onClick={() => setExpanded(isOpen ? null : type)}
              className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-[#1f56d4]">
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
                <FormDataViewer data={latest.formData} />
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
                            <FormDataViewer data={s.formData} compact />
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

      {/* Missing forms warning */}
      {(() => {
        const {
          PACKAGE_FORMS, SERVICE_FORM_MAP, normalizeFormType,
        } = require('@/lib/career/types') as typeof import('@/lib/career/types');

        // Build required forms from services (new-style) or packageType (legacy)
        const clientServices = forms.length > 0
          ? [] // services prop not available here — use packageType fallback
          : [];
        const required: string[] = packageType ? (PACKAGE_FORMS[packageType] ?? []) : [];

        // Normalize ALL submitted form types (old "resume" → "career_profile") before comparing
        const submittedNormalized = new Set(
          Object.keys(byType).map((t: string) => normalizeFormType(t))
        );
        const missing = required.filter((r: string) => !submittedNormalized.has(r as import('@/lib/career/types').FormType));
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
    if (fileCategory === 'final') return 'Final Delivery';
    if (LINKEDIN_TYPES.has(fileType)) return 'LinkedIn Draft Ready';
    // We don't know revision count on frontend — backend decides REVISED_DRAFT vs DRAFT_READY
    return 'Draft Ready (or Revised Draft if client has prior revisions)';
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
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Document Type</label>
              <select value={fileType} onChange={e => setFileType(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                {FILE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">File</label>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
              className="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-slate-200 rounded-xl p-1" />
          </div>

          {/* Email notification checkbox */}
          <label className={`flex items-start gap-3 px-3.5 py-3 rounded-xl border cursor-pointer transition-all ${
            sendEmail
              ? 'bg-blue-50 border-blue-200'
              : 'bg-slate-50 border-slate-200 hover:border-slate-300'
          }`}>
            <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)}
              className="mt-0.5 accent-blue-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-700">
                Notify client by email after upload
              </p>
              {sendEmail && (
                <p className="text-xs text-blue-600 mt-0.5">
                  Will send: <strong>{emailPreview}</strong>
                </p>
              )}
              {!sendEmail && (
                <p className="text-xs text-slate-400 mt-0.5">Client will not be notified</p>
              )}
            </div>
          </label>

          <button onClick={upload} disabled={uploading || !label.trim()}
            className="w-full py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
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
      <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
        {file.fileType === 'resume' ? (
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="#1f56d4" strokeWidth="2" strokeLinecap="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6M9 13h6M9 17h4"/></svg>
        ) : file.fileType === 'linkedin_banner' ? (
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke="#1f56d4" strokeWidth="2"/><circle cx="8.5" cy="8.5" r="1.5" stroke="#1f56d4" strokeWidth="2"/><path stroke="#1f56d4" strokeWidth="2" strokeLinecap="round" d="M21 15l-5-5L5 21"/></svg>
        ) : file.fileType === 'linkedin_profile_picture' ? (
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" stroke="#1f56d4" strokeWidth="2"/><path stroke="#1f56d4" strokeWidth="2" strokeLinecap="round" d="M4 20c0-4 3.582-7 8-7s8 3 8 7"/></svg>
        ) : file.fileType === 'cover_letter' ? (
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="#1f56d4" strokeWidth="2" strokeLinecap="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
        ) : (
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="#1f56d4" strokeWidth="2" strokeLinecap="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
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
          className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium transition-colors">
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
  if (logs.length === 0) {
    return <EmptyCard icon={<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>} title="No emails sent yet" subtitle="Email history will appear here once you trigger or send emails." />;
  }

  const triggerLabel: Record<string, string> = {
    WELCOME: 'Welcome', FORM_CONFIRM: 'Form Confirmation',
    DRAFT_READY: 'Draft Ready', LINKEDIN_DRAFT: 'LinkedIn Draft Ready',
    REVISED_DRAFT: 'Revised Draft Ready', REVISION: 'Revision Update',
    FINAL_DELIVERY: 'Final Delivery', LINKEDIN_SECURITY: 'LinkedIn Security',
    DELETE_OTP: 'Account Deletion OTP', MESSAGE_NOTIFY: 'Message Notification',
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{logs.length} email{logs.length !== 1 ? 's' : ''} sent</p>
      </div>
      <div className="divide-y divide-slate-100">
        {logs.map(log => (
          <div key={log.id} className="flex items-center justify-between px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                log.status === 'sent' ? 'bg-emerald-100' : 'bg-red-100'
              }`}>
                {log.status === 'sent' ? '✓' : '✗'}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {triggerLabel[log.trigger] ?? log.trigger}
                </p>
                <p className="text-xs text-slate-400">{fmt(log.sentAt, true)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                log.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
              }`}>
                {log.status}
              </span>
              {log.resendId && (
                <span className="text-xs text-slate-300 font-mono hidden sm:block truncate max-w-[120px]">
                  {log.resendId.slice(0, 12)}…
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Activity Tab ──────────────────────────────────────────────────────────────

function ActivityTab({ logs }: { logs: ActivityLog[] }) {
  if (logs.length === 0) {
    return <EmptyCard icon={<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>} title="No activity yet" subtitle="Actions taken on this client will be logged here." />;
  }

  return (
    <div className="space-y-2">
      {logs.map(log => (
        <div key={log.id} className="flex items-start gap-3 bg-white border border-slate-100 rounded-xl px-4 py-3 shadow-sm">
          <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
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
            <p className="text-xs text-slate-400">{fmt(log.createdAt, true)}</p>
            <p className="text-xs text-slate-300">{log.performedBy}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Revision Admin Tab ────────────────────────────────────────────────────────

const REV_STATUS_STYLE: Record<string, string> = {
  PENDING:  'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DENIED:   'bg-red-50 text-red-700 border-red-200',
};

function RevisionAdminTab({ clientId, clientName, clientPackage }: {
  clientId: string;
  clientName: string;
  clientPackage: CareerPackage | null;
}) {
  const [revisions,   setRevisions]   = useState<RevisionItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [note,        setNote]        = useState('');
  const [fileLabel,   setFileLabel]   = useState('');
  const [sendEmail,   setSendEmail]   = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const [toast,       setToast]       = useState('');
  // Inline confirm state for approve/deny
  const [confirmId,       setConfirmId]       = useState<string | null>(null);
  const [confirmDecision, setConfirmDecision] = useState<'APPROVED' | 'DENIED' | null>(null);
  const [confirmNote,     setConfirmNote]     = useState('');
  const [confirmEmail,    setConfirmEmail]    = useState(true);
  const [confirming,      setConfirming]      = useState(false);

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
      body: JSON.stringify({ note: note.trim(), fileLabel: fileLabel.trim() || undefined, sendEmail }),
    });
    setSaving(false);
    if (res.ok) {
      const d = await res.json() as { revision: RevisionItem };
      setRevisions(prev => [d.revision, ...prev]);
      setNote(''); setFileLabel(''); setShowForm(false);
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
          className="px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors">
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
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Revision Instructions *</label>
              <textarea required rows={4} value={note} onChange={e => setNote(e.target.value)}
                placeholder="Describe what needs to be revised…"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 resize-none" />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 accent-blue-600" />
              Send revision email to client ({clientPackage})
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={saving || note.trim().length < 5}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2">
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
                    <div className="mt-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
                      <p className="text-xs text-blue-700"><strong>Admin note:</strong> {r.adminNote}</p>
                    </div>
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
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 resize-none" />
                      <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                        <input type="checkbox" checked={confirmEmail} onChange={e => setConfirmEmail(e.target.checked)}
                          className="w-4 h-4 accent-blue-600" />
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

interface CommentItem {
  id: string; authorType: string; authorName: string; content: string; createdAt: string;
}

function CommentsAdminTab({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [comments,  setComments]  = useState<CommentItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [reply,     setReply]     = useState('');
  const [posting,   setPosting]   = useState(false);
  const [error,     setError]     = useState('');

  useEffect(() => {
    fetch(`/api/career/admin/clients/${clientId}/comments`)
      .then(r => r.json() as Promise<{ comments: CommentItem[] }>)
      .then(d => { setComments(d.comments ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [clientId]);

  const postReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setPosting(true); setError('');
    const res = await fetch(`/api/career/admin/clients/${clientId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: reply.trim() }),
    });
    if (res.ok) {
      const d = await res.json() as { comment: CommentItem };
      setComments(prev => [...prev, d.comment]);
      setReply('');
    } else {
      const d = await res.json().catch(() => ({})) as { error?: string };
      setError(d.error ?? 'Failed to post reply.');
    }
    setPosting(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Client Messages</h3>
          <p className="text-xs text-slate-400 mt-0.5">Conversation with {clientName}</p>
        </div>
        {!loading && (
          <span className="text-xs text-slate-400">{comments.length} message{comments.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Thread */}
      <div className="p-5 space-y-4 max-h-[480px] overflow-y-auto">
        {loading ? (
          <div className="space-y-3">
            {[1,2].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                <path stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
              </svg>
            </div>
            <p className="text-sm text-slate-500 font-medium">No messages yet</p>
            <p className="text-xs text-slate-400 mt-1">Client hasn&apos;t sent any messages. You can initiate below.</p>
          </div>
        ) : comments.map(c => (
          <div key={c.id} className={`flex gap-3 ${c.authorType === 'admin' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
              c.authorType === 'admin' ? 'bg-[#1f56d4] text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              {c.authorType === 'admin' ? 'RN' : c.authorName[0]?.toUpperCase() ?? 'C'}
            </div>
            <div className={`max-w-[72%] ${c.authorType === 'admin' ? 'items-end flex flex-col' : ''}`}>
              <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                c.authorType === 'admin'
                  ? 'bg-[#1f56d4] text-white rounded-tr-sm'
                  : 'bg-slate-100 text-slate-800 rounded-tl-sm'
              }`}>
                {c.content}
              </div>
              <p className="text-xs text-slate-400 mt-1 px-1">
                {c.authorType === 'admin' ? 'Ripple Nexus Team' : c.authorName}
                {' · '}{fmt(c.createdAt, true)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Reply input */}
      <div className="border-t border-slate-100 p-4">
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        <form onSubmit={postReply} className="flex gap-2">
          <input
            type="text"
            value={reply}
            onChange={e => setReply(e.target.value)}
            placeholder={`Reply to ${clientName}…`}
            className="flex-1 px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
          />
          <button type="submit" disabled={posting || !reply.trim()}
            className="px-4 py-2.5 bg-[#1f56d4] text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
            {posting ? <Spinner /> : (
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
              </svg>
            )}
            {posting ? '' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function FormDataViewer({ data, compact = false }: { data: Record<string, unknown>; compact?: boolean }) {
  return (
    <div className={`space-y-${compact ? '2' : '3'}`}>
      {Object.entries(data).map(([key, value]) => {
        if (value === null || value === undefined || value === '') return null;
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const isFile = typeof value === 'object' && value !== null && 'name' in value;
        const isArray = Array.isArray(value);
        const strVal = isFile
          ? (value as { name: string }).name
          : isArray
            ? (value as string[]).join(', ')
            : String(value);
        const isLong = strVal.length > 80;
        return (
          <div key={key} className={compact ? 'text-xs' : 'text-sm'}>
            <dt className={`font-semibold text-slate-500 ${compact ? 'text-xs' : 'text-xs'} uppercase tracking-wide mb-0.5`}>
              {label}
            </dt>
            {isFile ? (
              <dd className="text-blue-600 flex items-center gap-1">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                <span className="font-medium">{strVal}</span>
              </dd>
            ) : isArray ? (
              <dd className="flex flex-wrap gap-1">
                {(value as string[]).map(tag => (
                  <span key={tag} className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
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
        <span className="text-[#1f56d4] flex-shrink-0">{icon}</span>{title}
      </h3>
      {children}
    </div>
  );
}

function CountBadge({ n }: { n: number }) {
  return (
    <span className="ml-1.5 px-1.5 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-full leading-none">
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
    name:        client.name,
    email:       client.email,
    phone:       client.phone ?? '',
    packageType: client.packageType as CareerPackage,
    amountPaid:  String(client.amountPaid),
    currency:    client.currency,
    notes:       client.notes ?? '',
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
      body: JSON.stringify({ ...form, amountPaid: Number(form.amountPaid) }),
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
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
            </div>
          ))}

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Package</label>
            <select value={form.packageType} onChange={set('packageType')}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50">
              {packages.map(p => <option key={p} value={p}>{PACKAGE_LABELS[p]}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Amount Paid</label>
              <input type="number" min="0" step="0.01" value={form.amountPaid} onChange={set('amountPaid')}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Currency</label>
              <input type="text" maxLength={3} value={form.currency} onChange={set('currency')}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 uppercase" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Internal Notes</label>
            <textarea rows={3} value={form.notes} onChange={set('notes')}
              placeholder="Optional admin notes…"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 py-2.5 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 text-sm font-bold text-white bg-[#1f56d4] rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
