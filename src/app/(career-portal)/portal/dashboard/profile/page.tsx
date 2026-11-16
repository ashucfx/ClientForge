'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClientPortalShell } from '@/components/ClientPortalShell';
import { SERVICE_LABELS } from '@/lib/career/types';
import type { CareerServiceSlug } from '@/lib/career/types';

interface Me {
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
  if (!me) return null;

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <ClientPortalShell clientName={me.name} title="Your profile" />
      <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 pb-28 sm:px-6 sm:py-9 lg:ml-64 lg:mr-auto lg:w-auto lg:px-8 lg:py-9 lg:pb-10">
        <section className="overflow-hidden rounded-3xl bg-[#0A0B0D] p-6 text-white shadow-xl sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#C9A96E]">Catalyst profile</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{me.name}</h1>
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
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="text-xs text-slate-400">Email</dt><dd className="mt-0.5 break-all font-semibold text-slate-800">{me.email}</dd></div>
              {me.phone && <div><dt className="text-xs text-slate-400">Phone</dt><dd className="mt-0.5 font-semibold text-slate-800">{me.phone}</dd></div>}
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
