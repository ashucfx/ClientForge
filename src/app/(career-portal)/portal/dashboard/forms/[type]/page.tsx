'use client';
// src/app/(career-portal)/portal/dashboard/forms/[type]/page.tsx

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { FormSchema, FormField } from '@/lib/career/types';

// ── Types ─────────────────────────────────────────────────────────────────────

type FieldValue = string | string[] | FileAttachment | null;
interface FileAttachment { name: string; size: number; dataUrl: string }
interface FormValues { [fieldId: string]: FieldValue }
interface PreviousSubmission { formData: FormValues; version: number }

// ── Section metadata ──────────────────────────────────────────────────────────

const SECTION_META: Record<string, { icon: React.ReactNode; color: string; desc?: string }> = {
  'Contact Information': {
    icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2"/></svg>,
    color: 'blue',
    desc: 'Basic details for your documents',
  },
  'Career Direction': {
    icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
    color: 'indigo',
    desc: 'Where you are and where you want to go',
  },
  'Professional Background': {
    icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>,
    color: 'violet',
    desc: 'Your work and education history',
  },
  'Skills & Achievements': {
    icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
    color: 'amber',
    desc: 'What makes you stand out',
  },
  'Additional Details': {
    icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 8v4m0 4h.01"/></svg>,
    color: 'slate',
    desc: 'Any other relevant information',
  },
  'Attachments': {
    icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>,
    color: 'emerald',
    desc: 'Upload supporting documents',
  },
  // LinkedIn sections
  'Account Access': {
    icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>,
    color: 'red',
    desc: 'Credentials used only for profile optimisation',
  },
  'Profile Media': {
    icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/><circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="2"/><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M21 15l-5-5L5 21"/></svg>,
    color: 'cyan',
    desc: 'Your professional photo',
  },
  'Optimisation Goals': {
    icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="2"/></svg>,
    color: 'blue',
    desc: 'What you want to achieve',
  },
  'Profile Assessment': {
    icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>,
    color: 'indigo',
    desc: 'Rate your current LinkedIn presence',
  },
  'Brand & Voice': {
    icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/></svg>,
    color: 'violet',
    desc: 'Tone and keyword strategy',
  },
  'Content Strategy': {
    icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>,
    color: 'emerald',
    desc: 'Target roles and featured content',
  },
};

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    iconBg: 'bg-blue-100'    },
  indigo:  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  text: 'text-indigo-700',  iconBg: 'bg-indigo-100'  },
  violet:  { bg: 'bg-violet-50',  border: 'border-violet-200',  text: 'text-violet-700',  iconBg: 'bg-violet-100'  },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   iconBg: 'bg-amber-100'   },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', iconBg: 'bg-emerald-100' },
  slate:   { bg: 'bg-slate-50',   border: 'border-slate-200',   text: 'text-slate-600',   iconBg: 'bg-slate-100'   },
  red:     { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     iconBg: 'bg-red-100'     },
  cyan:    { bg: 'bg-cyan-50',    border: 'border-cyan-200',    text: 'text-cyan-700',    iconBg: 'bg-cyan-100'    },
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FormPage() {
  const { type } = useParams<{ type: string }>();
  const router   = useRouter();

  const [schema,     setSchema]     = useState<FormSchema | null>(null);
  const [values,     setValues]     = useState<FormValues>({});
  const [errors,     setErrors]     = useState<Record<string, string>>({});
  const [agreed,     setAgreed]     = useState(false);
  const [previous,   setPrevious]   = useState<PreviousSubmission | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState(false);

  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    try {
      const [formsRes, prevRes] = await Promise.all([
        fetch('/api/career/portal/forms'),
        fetch(`/api/career/portal/forms/${type}`),
      ]);
      if (formsRes.status === 401 || prevRes.status === 401) { router.replace('/portal/login'); return; }
      const { forms }      = await formsRes.json() as { forms: FormSchema[] };
      const { submission } = await prevRes.json()  as { submission: PreviousSubmission | null };
      const found = forms.find(f => f.formType === type);
      if (!found) { router.replace('/portal/dashboard'); return; }
      setSchema(found);
      if (submission?.formData) { setValues(submission.formData as FormValues); setPrevious(submission); }
      setLoading(false);
    } catch { router.replace('/portal/login'); }
  }, [type, router]);

  useEffect(() => { void load(); }, [load]);

  // ── Completion progress ───────────────────────────────────────────────────

  const { filledCount, totalRequired } = useMemo(() => {
    if (!schema) return { filledCount: 0, totalRequired: 0 };
    const required = schema.fields.filter(f => f.required && f.type !== 'file');
    const filled = required.filter(f => {
      const v = values[f.id];
      if (f.type === 'checkbox' || f.type === 'tags') return Array.isArray(v) && v.length > 0;
      if (f.type === 'rating') return !!v && String(v).trim() !== '';
      return !!v && String(v).trim() !== '';
    });
    return { filledCount: filled.length, totalRequired: required.length };
  }, [schema, values]);

  const pct = totalRequired > 0 ? Math.round((filledCount / totalRequired) * 100) : 0;

  // ── Validation ─────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    if (!schema) return false;
    const errs: Record<string, string> = {};
    for (const field of schema.fields) {
      if (!field.required) continue;
      const val = values[field.id];
      if (field.type === 'file') continue;
      if (field.type === 'tags' || field.type === 'checkbox') {
        if (!Array.isArray(val) || val.length === 0) errs[field.id] = `${field.label} is required`;
      } else if (field.type === 'rating') {
        if (!val || String(val).trim() === '') errs[field.id] = `Please select a rating`;
      } else if (!val || String(val).trim() === '') {
        errs[field.id] = `This field is required`;
      }
    }
    if (!agreed) errs.__disclaimer = 'You must accept the disclaimer to continue';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      const firstKey = Object.keys(errors)[0];
      document.getElementById(`field-${firstKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSubmitting(true); setSubmitError('');
    const payload: FormValues = { ...values };
    for (const field of (schema?.fields ?? [])) {
      if (field.type !== 'file') continue;
      const input = fileRefs.current[field.id];
      const file  = input?.files?.[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          setErrors(e => ({ ...e, [field.id]: `Max 5 MB` }));
          setSubmitting(false); return;
        }
        payload[field.id] = { name: file.name, size: file.size, dataUrl: await readAsDataUrl(file) };
      }
    }
    const res = await fetch(`/api/career/portal/forms/${type}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.status === 401) { router.replace('/portal/login'); return; }
    if (!res.ok) {
      const d = await res.json() as { error?: string };
      setSubmitError(d.error ?? 'Submission failed. Please try again.');
      setSubmitting(false); return;
    }
    setSubmitting(false); setDone(true);
  };

  const set = (id: string, val: FieldValue) => {
    setValues(prev => ({ ...prev, [id]: val }));
    if (errors[id]) setErrors(e => { const n = { ...e }; delete n[id]; return n; });
  };

  // ── Group fields by section ────────────────────────────────────────────────

  const sections = useMemo(() => {
    if (!schema) return [];
    const map = new Map<string, FormField[]>();
    for (const field of schema.fields) {
      const sec = field.section ?? 'Other';
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push(field);
    }
    return Array.from(map.entries()).map(([name, fields]) => ({ name, fields }));
  }, [schema]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return <LoadingScreen />;
  if (!schema) return null;

  // ── Success ────────────────────────────────────────────────────────────────
  if (done) return (
    <FormShell schema={schema}>
      <div className="text-center py-14">
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-30" />
          <div className="relative w-24 h-24 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-200">
            <svg width="40" height="40" fill="none" viewBox="0 0 24 24">
              <path stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          {previous ? 'Successfully updated!' : 'Successfully submitted!'}
        </h2>
        <p className="text-slate-500 text-sm max-w-sm mx-auto mb-8 leading-relaxed">
          We have received your <strong className="text-slate-700">{schema.title}</strong> details.
          Our team will begin work shortly and notify you by email when your draft is ready.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/portal/dashboard"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#1f56d4] text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all shadow-sm shadow-blue-200">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M19 12H5m7-7l-7 7 7 7"/></svg>
            Back to Dashboard
          </Link>
          <button onClick={() => { setDone(false); setPrevious({ formData: values, version: (previous?.version ?? 0) + 1 }); }}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            Edit submission
          </button>
        </div>
      </div>
    </FormShell>
  );

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <FormShell schema={schema}>
      {/* Revision notice */}
      {previous && (
        <div className="mb-6 flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
          <svg className="flex-shrink-0 mt-0.5 text-blue-600" width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p className="text-blue-700 text-sm">
            <strong>Updating your submission</strong> (v{previous.version}) — submitting will replace your previous answers.
          </p>
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Form completion</span>
          <span className={`text-xs font-bold ${pct === 100 ? 'text-emerald-600' : 'text-[#1f56d4]'}`}>
            {filledCount} / {totalRequired} required fields
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-[#1f56d4] to-blue-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {pct === 100 && (
          <p className="text-xs text-emerald-600 font-semibold mt-1.5 flex items-center gap-1">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M5 13l4 4L19 7"/></svg>
            All required fields complete — ready to submit
          </p>
        )}
      </div>

      {/* Description */}
      <div className="mb-8 p-5 bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200 rounded-2xl">
        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{schema.description}</p>
      </div>

      {submitError && (
        <div className="mb-6 flex gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
          <svg className="flex-shrink-0 mt-0.5 text-red-500" width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p className="text-red-700 text-sm">{submitError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-6">

        {/* Section cards */}
        {sections.map(({ name, fields }) => {
          const meta  = SECTION_META[name];
          const color = meta?.color ?? 'slate';
          const c     = COLOR_MAP[color] ?? COLOR_MAP.slate;

          return (
            <div key={name} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              {/* Section header */}
              <div className={`flex items-center gap-3 px-5 py-4 ${c.bg} border-b ${c.border}`}>
                <div className={`w-8 h-8 ${c.iconBg} rounded-lg flex items-center justify-center ${c.text} flex-shrink-0`}>
                  {meta?.icon}
                </div>
                <div>
                  <h3 className={`text-sm font-bold ${c.text}`}>{name}</h3>
                  {meta?.desc && <p className="text-xs text-slate-400 mt-0.5">{meta.desc}</p>}
                </div>
                {/* Section completion dot */}
                {fields.every(f => {
                  if (!f.required || f.type === 'file') return true;
                  const v = values[f.id];
                  if (f.type === 'checkbox' || f.type === 'tags') return Array.isArray(v) && v.length > 0;
                  return !!v && String(v).trim() !== '';
                }) && fields.some(f => f.required) && (
                  <div className="ml-auto flex items-center gap-1.5 text-emerald-600 text-xs font-semibold flex-shrink-0">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M5 13l4 4L19 7"/></svg>
                    Done
                  </div>
                )}
              </div>

              {/* Executive disclaimer for Attachments section */}
              {name === 'Attachments' && (
                <div className="mx-5 mt-5 flex items-start gap-3 px-4 py-3.5 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl">
                  <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
                      <path stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-indigo-800 mb-0.5">Executive & Executive+ Clients</p>
                    <p className="text-xs text-indigo-700 leading-relaxed">
                      If you have an extensive career history, simply attach your existing resume and write{' '}
                      <strong>"Refer to resume"</strong> in the relevant text fields above.
                      Our team will work directly from your document — no need to re-type everything.
                    </p>
                  </div>
                </div>
              )}

              {/* Fields */}
              <div className="p-5 space-y-5">
                {fields.map(field => (
                  <FieldRenderer
                    key={field.id}
                    field={field}
                    value={values[field.id] ?? null}
                    error={errors[field.id]}
                    onChange={val => set(field.id, val)}
                    fileRef={el => { fileRefs.current[field.id] = el; }}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Disclaimer */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 bg-slate-50 border-b border-slate-200">
            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 flex-shrink-0">
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-700">Disclaimer & Agreement</h3>
              <p className="text-xs text-slate-400 mt-0.5">Please read and accept before submitting</p>
            </div>
          </div>
          <div className="p-5">
            <p className="text-sm text-slate-500 leading-relaxed mb-4">{schema.disclaimer}</p>
            <label className={`flex items-start gap-3 cursor-pointer p-4 rounded-xl border-2 transition-all ${
              agreed
                ? 'bg-emerald-50 border-emerald-300'
                : errors.__disclaimer
                  ? 'border-red-300 bg-red-50'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}>
              <div
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                  agreed ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'
                }`}
                onClick={() => { setAgreed(!agreed); if (errors.__disclaimer) setErrors(e => { const n={...e}; delete n.__disclaimer; return n; }); }}>
                {agreed && <svg width="10" height="10" fill="none" viewBox="0 0 24 24"><path stroke="white" strokeWidth="3" strokeLinecap="round" d="M5 13l4 4L19 7"/></svg>}
              </div>
              <span
                className="text-sm text-slate-700 font-medium select-none leading-relaxed"
                onClick={() => { setAgreed(!agreed); if (errors.__disclaimer) setErrors(e => { const n={...e}; delete n.__disclaimer; return n; }); }}>
                I have read and agree to the above disclaimer
              </span>
            </label>
            {errors.__disclaimer && (
              <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                {errors.__disclaimer}
              </p>
            )}
          </div>
        </div>

        {/* Submit button */}
        <button type="submit" disabled={submitting}
          className="w-full py-4 bg-gradient-to-r from-[#1f56d4] to-blue-500 text-white text-sm font-bold rounded-xl hover:from-blue-700 hover:to-blue-600 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-md shadow-blue-200 flex items-center justify-center gap-2">
          {submitting ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Submitting…
            </>
          ) : (
            <>
              {previous ? 'Update My Submission' : 'Submit My Details'}
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M5 12h14m-7-7l7 7-7 7"/></svg>
            </>
          )}
        </button>

        <p className="text-xs text-center text-slate-400 pb-4">
          You can update your submission at any time before our team begins work.
        </p>
      </form>
    </FormShell>
  );
}

// ── Field Renderer ─────────────────────────────────────────────────────────────

function FieldRenderer({ field, value, error, onChange, fileRef }: {
  field: FormField;
  value: FieldValue;
  error?: string;
  onChange: (v: FieldValue) => void;
  fileRef: (el: HTMLInputElement | null) => void;
}) {
  const base = `w-full px-4 py-3 text-sm border rounded-xl bg-white transition-all outline-none
    focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400
    ${error ? 'border-red-300 focus:ring-red-400' : 'border-slate-200 hover:border-slate-300'}`;

  const isArr = field.type === 'tags' || field.type === 'checkbox';
  const filled = isArr
    ? Array.isArray(value) && value.length > 0
    : field.type === 'rating' ? !!value : !!value && String(value).trim() !== '';

  return (
    <div id={`field-${field.id}`}>
      {/* Label */}
      <div className="flex items-start justify-between mb-1.5">
        <label className="text-sm font-semibold text-slate-800 leading-snug">
          {field.label}
          {field.required
            ? <span className="text-red-400 ml-1 font-bold">*</span>
            : <span className="text-slate-400 text-xs font-normal ml-1.5">optional</span>
          }
        </label>
        {filled && !error && (
          <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1 flex-shrink-0 ml-2">
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M5 13l4 4L19 7"/></svg>
            Done
          </span>
        )}
      </div>

      {/* Hint */}
      {field.hint && (
        <p className="text-xs text-slate-400 mb-2.5 leading-relaxed">{field.hint}</p>
      )}

      {/* Textarea */}
      {field.type === 'textarea' && (
        <textarea rows={5} value={(value as string) ?? ''} onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder} required={field.required}
          className={`${base} resize-y min-h-[100px]`} />
      )}

      {/* Select */}
      {field.type === 'select' && (
        <select value={(value as string) ?? ''} onChange={e => onChange(e.target.value)}
          required={field.required} className={base}>
          <option value="">Choose an option…</option>
          {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )}

      {/* Tags */}
      {field.type === 'tags' && (
        <TagInput value={(value as string[]) ?? []} onChange={onChange}
          placeholder={field.placeholder} error={error} />
      )}

      {/* Checkbox multi-select */}
      {field.type === 'checkbox' && field.options && (
        <CheckboxGroup options={field.options} value={(value as string[]) ?? []}
          onChange={onChange} error={error} />
      )}

      {/* Rating */}
      {field.type === 'rating' && (
        <RatingInput value={(value as string) ?? ''} onChange={v => onChange(v)} error={error} />
      )}

      {/* Password */}
      {field.type === 'password' && (
        <div className="space-y-2">
          <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
            <svg className="flex-shrink-0 mt-0.5" width="14" height="14" fill="none" viewBox="0 0 24 24">
              <path stroke="#d97706" strokeWidth="2" strokeLinecap="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
            <p className="text-xs text-amber-700 leading-relaxed">
              Your credentials are encrypted end-to-end. They are used solely for profile optimisation and never shared.
              Please change your LinkedIn password once work is complete.
            </p>
          </div>
          <input type="password" value={(value as string) ?? ''} onChange={e => onChange(e.target.value)}
            placeholder={field.placeholder} required={field.required}
            autoComplete="new-password" className={base} />
        </div>
      )}

      {/* File upload */}
      {field.type === 'file' && (
        <div>
          <div className={`border-2 border-dashed rounded-xl transition-all ${
            error ? 'border-red-300 bg-red-50/30' : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/20'
          }`}>
            <input type="file" accept={field.accept} ref={fileRef}
              required={field.required} className="hidden"
              id={`file-${field.id}`}
              onChange={e => { const f = e.target.files?.[0]; if (f) onChange({ name: f.name, size: f.size, dataUrl: '' }); }} />
            <label htmlFor={`file-${field.id}`} className="cursor-pointer block p-6">
              {value && typeof value === 'object' && 'name' in value ? (
                <div className="flex items-center justify-center gap-3 text-sm">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path stroke="#16a34a" strokeWidth="2" strokeLinecap="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  </div>
                  <div>
                    <p className="font-semibold text-emerald-700">{(value as FileAttachment).name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{((value as FileAttachment).size / 1024).toFixed(0)} KB · Click to change</p>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
                      <path stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" d="M12 16V8m-4 4l4-4 4 4M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14"/>
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-700">Click to upload</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {field.accept?.replace(/\./g, '').toUpperCase().replace(/,/g, ' · ')} · Max 5 MB
                  </p>
                </div>
              )}
            </label>
          </div>
          {value && typeof value === 'object' && 'name' in value && (
            <button type="button" onClick={() => onChange(null)}
              className="mt-1.5 text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1 transition-colors">
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/></svg>
              Remove file
            </button>
          )}
        </div>
      )}

      {/* Text / URL */}
      {(field.type === 'text' || field.type === 'url') && (
        <input type={field.type === 'url' ? 'url' : 'text'}
          value={(value as string) ?? ''} onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder} required={field.required}
          className={base} />
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

// ── Checkbox Group ─────────────────────────────────────────────────────────────

function CheckboxGroup({ options, value, onChange, error }: {
  options: string[]; value: string[];
  onChange: (v: string[]) => void; error?: string;
}) {
  const toggle = (opt: string) => {
    if (value.includes(opt)) onChange(value.filter(v => v !== opt));
    else onChange([...value, opt]);
  };
  return (
    <div className={`rounded-xl border overflow-hidden ${error ? 'border-red-300' : 'border-slate-200'}`}>
      {options.map((opt, i) => {
        const checked = value.includes(opt);
        return (
          <label key={opt}
            className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all ${
              i > 0 ? 'border-t border-slate-100' : ''
            } ${checked ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
              checked ? 'bg-[#1f56d4] border-[#1f56d4]' : 'border-slate-300 bg-white'
            }`} onClick={() => toggle(opt)}>
              {checked && <svg width="10" height="10" fill="none" viewBox="0 0 24 24"><path stroke="white" strokeWidth="3" strokeLinecap="round" d="M5 13l4 4L19 7"/></svg>}
            </div>
            <span className={`text-sm select-none transition-colors ${checked ? 'text-blue-700 font-medium' : 'text-slate-700'}`}
              onClick={() => toggle(opt)}>
              {opt}
            </span>
            {checked && (
              <svg className="ml-auto text-blue-400 flex-shrink-0" width="14" height="14" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M5 13l4 4L19 7"/>
              </svg>
            )}
          </label>
        );
      })}
      {value.length > 0 && (
        <div className="px-4 py-2 bg-blue-50 border-t border-blue-100 flex items-center justify-between">
          <span className="text-xs text-blue-600 font-semibold">{value.length} selected</span>
          <button type="button" onClick={() => onChange([])}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors">Clear</button>
        </div>
      )}
    </div>
  );
}

// ── Rating Input ───────────────────────────────────────────────────────────────

function RatingInput({ value, onChange, error }: {
  value: string; onChange: (v: string) => void; error?: string;
}) {
  const labels = ['', 'Poor', 'Fair', 'Average', 'Good', 'Excellent'];
  const colors = ['', 'bg-red-500', 'bg-orange-400', 'bg-amber-400', 'bg-lime-500', 'bg-emerald-500'];
  const n = Number(value);
  return (
    <div>
      <div className={`flex items-stretch gap-0 border rounded-xl overflow-hidden ${error ? 'border-red-300' : 'border-slate-200'}`}>
        {[1, 2, 3, 4, 5].map(num => {
          const active = value === String(num);
          return (
            <button key={num} type="button" onClick={() => onChange(String(num))}
              className={`flex-1 py-3.5 text-sm font-bold transition-all border-r last:border-r-0 border-slate-100 ${
                active
                  ? `${colors[num]} text-white shadow-inner`
                  : 'bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600'
              }`}>
              {num}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between px-1 mt-2">
        <span className="text-xs text-slate-400">1 — Poor</span>
        {n > 0 && (
          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full text-white ${colors[n]}`}>
            {n} — {labels[n]}
          </span>
        )}
        <span className="text-xs text-slate-400">Excellent — 5</span>
      </div>
    </div>
  );
}

// ── Tag Input ──────────────────────────────────────────────────────────────────

function TagInput({ value, onChange, placeholder, error }: {
  value: string[]; onChange: (v: string[]) => void;
  placeholder?: string; error?: string;
}) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const add = () => { const tag = input.trim(); if (tag && !value.includes(tag)) onChange([...value, tag]); setInput(''); };
  const remove = (tag: string) => onChange(value.filter(t => t !== tag));
  return (
    <div className={`border rounded-xl bg-white transition-all focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent ${
      error ? 'border-red-300' : 'border-slate-200 hover:border-slate-300'
    }`} onClick={() => inputRef.current?.focus()}>
      <div className="p-3 flex flex-wrap gap-1.5">
        {value.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
            {tag}
            <button type="button" onClick={e => { e.stopPropagation(); remove(tag); }}
              className="text-blue-400 hover:text-blue-900 ml-0.5">
              <svg width="10" height="10" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </span>
        ))}
        <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
            if (e.key === 'Backspace' && !input && value.length > 0) remove(value[value.length - 1]);
          }}
          placeholder={value.length === 0 ? (placeholder ?? 'Type and press Enter') : 'Add more…'}
          className="flex-1 min-w-[120px] text-sm outline-none px-1 py-1 bg-transparent text-slate-700 placeholder-slate-400" />
      </div>
      {value.length > 0 && (
        <div className="px-3 py-2 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-400">{value.length} tag{value.length !== 1 ? 's' : ''}</span>
          <button type="button" onClick={() => onChange([])} className="text-xs text-red-400 hover:text-red-600 font-medium">Clear all</button>
        </div>
      )}
    </div>
  );
}

// ── Form Shell (header + page wrapper) ────────────────────────────────────────

function FormShell({ schema, children }: { schema: FormSchema; children: React.ReactNode }) {
  const formTypeLabel: Record<string, string> = {
    resume: 'Career Information',
    linkedin: 'LinkedIn Optimisation',
    cover_letter: 'Cover Letter',
  };
  const formTypeIcon: Record<string, React.ReactNode> = {
    resume: <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6M9 13h6M9 17h4"/></svg>,
    linkedin: <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="2"/><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M7 10v7M7 7v.5M12 17v-4a2 2 0 014 0v4M12 13v4"/></svg>,
    cover_letter: <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">
      {/* Sticky header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/portal/dashboard"
            className="flex items-center gap-1.5 text-slate-400 hover:text-blue-600 transition-colors flex-shrink-0">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M19 12H5m7-7l-7 7 7 7"/>
            </svg>
            <span className="text-sm hidden sm:inline">Dashboard</span>
          </Link>
          <div className="w-px h-4 bg-slate-200 flex-shrink-0" />
          {/* Brand */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg overflow-hidden border border-slate-100 flex-shrink-0">
              <Image src="/Logo.jpg" width={28} height={28} alt="Ripple Nexus" className="w-full h-full object-contain" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-slate-900 leading-none">Ripple Nexus</p>
              <span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold rounded tracking-wide leading-none mt-0.5">
                ClientForge Boost
              </span>
            </div>
          </div>
          <div className="w-px h-4 bg-slate-200 flex-shrink-0" />
          {/* Form identity */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 text-[#1f56d4] flex-shrink-0">
              {formTypeIcon[schema.formType] ?? formTypeIcon.resume}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate leading-none">{schema.title}</p>
              <p className="text-[10px] text-slate-400 leading-none mt-0.5 hidden sm:block">
                {formTypeLabel[schema.formType] ?? 'Form'}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Hero banner */}
      <div className="bg-gradient-to-r from-[#0f172a] via-[#1e3a5f] to-[#0f172a] border-b border-slate-800">
        <div className="max-w-2xl mx-auto px-4 py-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
            {formTypeIcon[schema.formType] ?? formTypeIcon.resume}
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">{schema.title}</h1>
            <p className="text-blue-300 text-xs mt-0.5">Career Booster Services · Ripple Nexus</p>
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-8" style={{ animation: 'fadeSlideIn 0.35s ease-out' }}>
        <style>{`@keyframes fadeSlideIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }`}</style>
        {children}
      </main>
    </div>
  );
}

// ── Loading screen ─────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-[#1f56d4] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-500 text-sm font-medium">Loading your form…</p>
      </div>
    </div>
  );
}

// ── Utils ──────────────────────────────────────────────────────────────────────

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
