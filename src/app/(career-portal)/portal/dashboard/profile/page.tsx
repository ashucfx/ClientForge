'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClientPortalShell } from '@/components/ClientPortalShell';
import { SERVICE_LABELS } from '@/lib/career/types';
import type { CareerServiceSlug } from '@/lib/career/types';

interface Me {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  country?: string | null;
  timezone?: string | null;
  packageLabel: string;
  services?: { slug: string; name: string }[];
}

interface Submission {
  submittedAt: string;
  version: number;
  formData: Record<string, unknown>;
}

interface ClientInvoice {
  id: string | null;
  invoiceNumber: string;
  status: string;
  currency: string;
  currencySymbol: string;
  totalPayable: number;
  invoiceDate: string;
  dueDate: string;
  paidAt: string | null;
  isLegacyReceipt?: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  fullName: 'Full name',
  targetRole: 'Target role',
  targetIndustry: 'Target industry',
  careerLevel: 'Career level',
  location: 'Preferred location',
  summary: 'Professional summary',
  experience: 'Experience',
  skills: 'Skills',
  achievements: 'Key achievements',
  goals: 'Career goals',
};
const SENSITIVE_FIELD_PATTERN = /password|passcode|secret|token|credential/i;

function displayValue(value: unknown): string {
  if (Array.isArray(value)) return value.filter(item => typeof item === 'string').join(', ');
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return '';
}

export default function ClientProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicesError, setInvoicesError] = useState(false);
  const [invoiceReloadKey, setInvoiceReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.all([
      fetch('/api/career/portal/me'),
      fetch('/api/career/portal/forms/career_profile'),
    ]).then(async ([meResponse, formResponse]) => {
      if (meResponse.status === 401) {
        router.replace('/portal/login');
        return;
      }
      const meData = await meResponse.json() as Me;
      const formData = formResponse.ok
        ? await formResponse.json() as { submission: Submission | null }
        : { submission: null };
      if (!active) return;
      setMe(meData);
      setSubmission(formData.submission);
      setLoading(false);
    }).catch(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    let active = true;
    setInvoicesLoading(true);
    setInvoicesError(false);
    void fetch('/api/career/portal/invoices')
      .then(async response => {
        if (!response.ok) throw new Error('Could not load invoices');
        return await response.json() as { invoices: ClientInvoice[] };
      })
      .then(data => { if (active) setInvoices(data.invoices ?? []); })
      .catch(() => { if (active) setInvoicesError(true); })
      .finally(() => { if (active) setInvoicesLoading(false); });
    return () => { active = false; };
  }, [invoiceReloadKey]);

  const profileFields = useMemo(() => {
    if (!submission) return [];
    return Object.entries(submission.formData)
      .filter(([key]) => !SENSITIVE_FIELD_PATTERN.test(key))
      .map(([key, value]) => ({ key, label: FIELD_LABELS[key] ?? key.replace(/([A-Z])/g, ' $1'), value: displayValue(value) }))
      .filter(field => field.value);
  }, [submission]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F4]">
        <ClientPortalShell title="Your profile" />
        <main className="mx-auto max-w-7xl px-4 py-8 pb-28 text-sm text-slate-500 sm:px-6 lg:ml-64 lg:mr-auto lg:px-8 lg:pb-10">Loading your profile…</main>
      </div>
    );
  }
  if (!me) {
    return (
      <div className="min-h-screen bg-[#FAF8F4]">
        <ClientPortalShell title="Your profile" />
        <main className="mx-auto max-w-7xl px-4 py-8 pb-28 sm:px-6 lg:ml-64 lg:mr-auto lg:px-8 lg:pb-10">
          <section role="status" className="mx-auto max-w-xl rounded-2xl border border-[#E8DDD0] bg-white p-6 text-center shadow-sm sm:p-8">
            <h1 className="text-lg font-bold text-slate-900">Your profile is temporarily unavailable</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">The workspace navigation is still available. Try reloading to fetch your profile again.</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0A0B0D] px-5 text-sm font-semibold text-white transition hover:bg-[#29251E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8935B]/50">
              Try again
            </button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <ClientPortalShell clientName={me.name} title="Your profile" />
      <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 pb-28 sm:px-6 sm:py-9 lg:ml-64 lg:mr-auto lg:w-auto lg:px-8 lg:py-9 lg:pb-10">
        <section className="overflow-hidden rounded-3xl bg-[#0A0B0D] p-5 text-white shadow-xl sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#C9A96E]">Catalyst profile</p>
              <h1 className="mt-2 break-words text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">Your profile</h1>
              <p className="mt-2 text-sm text-white/60">Your account details and career brief, kept together for your project team.</p>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#B8935B] text-2xl font-bold text-white">
              {me.name[0]?.toUpperCase()}
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#E8DDD0] bg-white p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9A7540]">Account details</p>
            <dl className="mt-4 grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
              <div className="min-w-0"><dt className="text-xs text-slate-400">Your name</dt><dd className="mt-0.5 break-words font-semibold text-slate-800">{me.name}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-slate-400">Your ID</dt><dd className="mt-0.5 break-all font-mono text-xs font-semibold text-slate-800">{me.id}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-slate-400">Email</dt><dd className="mt-0.5 break-all font-semibold text-slate-800">{me.email}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-slate-400">Mobile</dt><dd className="mt-0.5 break-words font-semibold text-slate-800">{me.phone || 'Not provided'}</dd></div>
              {me.country && <div><dt className="text-xs text-slate-400">Country</dt><dd className="mt-0.5 font-semibold text-slate-800">{me.country}</dd></div>}
              {me.timezone && <div><dt className="text-xs text-slate-400">Timezone</dt><dd className="mt-0.5 font-semibold text-slate-800">{me.timezone}</dd></div>}
            </dl>
          </div>
          <div className="rounded-2xl border border-[#E8DDD0] bg-white p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9A7540]">Your services</p>
            <p className="mt-3 text-lg font-bold text-slate-900">{me.packageLabel}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(me.services ?? []).map(service => (
                <span key={service.slug} className="rounded-full border border-[#E5D4B4] bg-[#FBF8F3] px-3 py-1 text-xs font-semibold text-[#8C6C39]">
                  {SERVICE_LABELS[service.slug as CareerServiceSlug] ?? service.name}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="client-invoices-heading" className="rounded-2xl border border-[#E8DDD0] bg-white p-5 sm:p-6">
          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9A7540]">Billing</p>
            <h2 id="client-invoices-heading" className="mt-1 text-lg font-bold text-slate-900">Invoices</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Invoices linked to your Catalyst account.</p>
          </div>

          {invoicesLoading ? (
            <div className="space-y-2" aria-label="Loading invoices" role="status">
              <div className="h-16 animate-pulse rounded-xl bg-[#F4F1EB]" />
              <div className="h-16 animate-pulse rounded-xl bg-[#F4F1EB]" />
            </div>
          ) : invoicesError ? (
            <div className="rounded-xl border border-[#E8DDD0] bg-[#FAF8F4] p-4 text-sm text-slate-600">
              <p>Invoices couldn’t be loaded right now.</p>
              <button type="button" onClick={() => setInvoiceReloadKey(value => value + 1)} className="mt-2 min-h-10 font-semibold text-[#8C6C39] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8935B]/40">Try again</button>
            </div>
          ) : invoices.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#D8C8B0] bg-[#FBF8F3] px-4 py-5 text-sm text-slate-500">No invoices are linked to this account yet.</div>
          ) : (
            <div className="divide-y divide-[#EEE7DC]">
              {invoices.map(invoice => {
                const isPaid = invoice.status === 'PAID';
                const statusClass = isPaid
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : invoice.status === 'PENDING' || invoice.status === 'PARTIALLY_PAID'
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-slate-200 bg-slate-50 text-slate-600';
                let amount: string;
                try {
                  amount = new Intl.NumberFormat(undefined, { style: 'currency', currency: invoice.currency }).format(invoice.totalPayable);
                } catch {
                  amount = `${invoice.currencySymbol}${invoice.totalPayable.toLocaleString()}`;
                }
                const invoiceDate = new Date(invoice.invoiceDate);
                const dateLabel = Number.isNaN(invoiceDate.getTime())
                  ? 'Date unavailable'
                  : invoiceDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
                const pdfHref = invoice.isLegacyReceipt || !invoice.id
                  ? '/api/career/portal/invoice/pdf'
                  : `/api/career/portal/invoice/pdf?invoiceId=${encodeURIComponent(invoice.id)}`;

                return (
                  <article key={invoice.id ?? invoice.invoiceNumber} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-all text-sm font-semibold text-slate-800">{invoice.invoiceNumber}</p>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusClass}`}>{invoice.status.replace(/_/g, ' ')}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Issued {dateLabel}</p>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <span className="text-sm font-bold tabular-nums text-slate-900">{amount}</span>
                      {isPaid && (
                        <a href={pdfHref} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-[#E5D4B4] bg-[#FBF8F3] px-3 text-xs font-semibold text-[#76562A] transition-colors hover:bg-[#F3EBDD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8935B]/40">
                          Receipt PDF
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[#E8DDD0] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9A7540]">Career profile strategy brief</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">Your submitted details</h2>
            </div>
            {submission && <span className="text-xs text-slate-400">Version {submission.version}</span>}
          </div>
          {profileFields.length > 0 ? (
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              {profileFields.map(field => (
                <div key={field.key} className="rounded-xl bg-[#FAF8F4] p-3.5 sm:col-span-1">
                  <dt className="text-xs font-semibold text-slate-400">{field.label}</dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{field.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-[#D8C8B0] bg-[#FBF8F3] p-5 text-sm text-slate-500">
              Your profile will appear here after you submit the Career Profile Strategy Brief.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
