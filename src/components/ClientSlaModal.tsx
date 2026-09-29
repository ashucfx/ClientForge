'use client';
// src/components/ClientSlaModal.tsx
// Fully responsive, legally binding SLA & Master Services Agreement Modal for Catalyst clients.

import React, { useState } from 'react';
import {
  CURRENT_SLA_VERSION,
  SLA_AGREEMENT_SECTIONS,
} from '@/lib/agreements/slaTerms';

interface ClientSlaModalProps {
  clientName: string;
  clientEmail: string;
  isOpen: boolean;
  onAccepted: () => void;
}

export function ClientSlaModal({
  clientName,
  clientEmail,
  isOpen,
  onAccepted,
}: ClientSlaModalProps) {
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAccept = async () => {
    if (!agreed) {
      setError('Please review and check the agreement box before proceeding.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/career/portal/agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted: true }),
      });
      if (res.ok) {
        onAccepted();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to record agreement. Please try again.');
      }
    } catch {
      setError('Network connection error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#0A0B0D]/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-[#B8935B]/30 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#0A0B0D] px-5 sm:px-8 py-5 border-b border-[#B8935B]/30 flex-shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#B8935B] animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#B8935B]">
                Catalyst Legal &amp; Turnaround SLA
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 bg-white/10 px-2 py-0.5 rounded">
              {CURRENT_SLA_VERSION}
            </span>
          </div>
          <h2 className="text-lg sm:text-2xl font-serif font-bold text-white mt-2">
            Client Master Agreement &amp; Delivery SLAs
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Please review our service commitments, turnaround timelines, and revision guidelines before accessing your workspace.
          </p>
        </div>

        {/* Client Identity Bar */}
        <div className="bg-[#FAF9F6] px-5 sm:px-8 py-2.5 border-b border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
          <div>
            Client: <strong className="text-slate-900">{clientName}</strong> ({clientEmail})
          </div>
          <div className="text-[11px] text-slate-400">
            Mandatory Intake Assent · Clickwrap Binding
          </div>
        </div>

        {/* Scrollable Terms Content */}
        <div className="p-5 sm:p-8 overflow-y-auto space-y-6 text-xs sm:text-sm text-slate-700 leading-relaxed bg-white">
          <div className="p-3.5 bg-[#FAF9F6] rounded-xl border border-slate-200 text-xs text-slate-600">
            <strong>Important Notice:</strong> By accepting below, you formalize our service turnaround timeline and fair-use revision boundaries. This ensures dedicated, high-touch calibration for your career documentation.
          </div>

          {SLA_AGREEMENT_SECTIONS.map((section, idx) => (
            <div key={idx} className="space-y-2 border-b border-slate-100 pb-4 last:border-b-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="text-[#B8935B]">§</span> {section.title}
              </h3>
              <p className="text-slate-600">{section.content}</p>
              {section.subpoints && (
                <ul className="list-disc pl-5 space-y-1 text-slate-600 text-xs sm:text-sm mt-1">
                  {section.subpoints.map((pt, pIdx) => (
                    <li key={pIdx}>{pt}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {/* Footer with Acceptance Checkbox and Action Button */}
        <div className="bg-[#FAF9F6] border-t border-slate-200 px-5 sm:px-8 py-4 sm:py-5 flex-shrink-0 space-y-3">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {error}
            </div>
          )}

          <label className="flex items-start gap-3 cursor-pointer group select-none">
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#B8935B] focus:ring-[#B8935B] transition-all cursor-pointer accent-[#B8935B]"
            />
            <span className="text-xs sm:text-sm text-slate-800 leading-snug">
              I have read, understood, and accept the <strong>Catalyst Master Services Agreement &amp; Delivery SLAs</strong> ({CURRENT_SLA_VERSION}). I understand that work commences immediately and the delivery clock begins upon submission of my intake forms.
            </span>
          </label>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <span className="text-[11px] text-slate-400 order-2 sm:order-1 text-center sm:text-left">
              🔒 Timestamp, IP address, and digital checksum will be cryptographically logged.
            </span>
            <button
              onClick={handleAccept}
              disabled={!agreed || submitting}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#B8935B] hover:bg-[#9A7540] text-white text-xs sm:text-sm font-bold uppercase tracking-wider transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-2 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Recording Assent…</span>
                </>
              ) : (
                <span>Accept Agreement &amp; Continue →</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
