'use client';
// src/components/ClientSlaModal.tsx
// Fully responsive, legally binding SLA & Master Services Agreement Modal for Catalyst clients.

import React, { useState, useEffect } from 'react';
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

  // Lock body scroll while mandatory modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-[#0A0B0D]/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div 
        className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-[#B8935B]/30 overflow-hidden flex flex-col my-auto max-h-[95vh] sm:max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sla-modal-title"
      >
        {/* Header */}
        <div className="bg-[#0A0B0D] px-4 sm:px-8 py-4 sm:py-5 border-b border-[#B8935B]/30 flex-shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#B8935B] animate-pulse shrink-0" />
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-[#B8935B]">
                Catalyst Legal &amp; Turnaround SLA
              </span>
            </div>
            <span className="text-[9.5px] sm:text-[10px] font-mono text-slate-300 bg-white/10 px-2 py-0.5 rounded shrink-0">
              {CURRENT_SLA_VERSION}
            </span>
          </div>
          <h2 id="sla-modal-title" className="text-base sm:text-xl md:text-2xl font-serif font-bold text-white mt-1.5 sm:mt-2">
            Client Master Agreement &amp; Delivery SLAs
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-300 mt-1 leading-relaxed">
            Please review our service commitments, turnaround timelines, and revision guidelines before accessing your workspace.
          </p>
        </div>

        {/* Client Identity Bar */}
        <div className="bg-[#FAF9F6] px-4 sm:px-8 py-2 border-b border-slate-200 text-[11px] sm:text-xs text-slate-600 flex flex-wrap items-center justify-between gap-1.5 flex-shrink-0">
          <div className="truncate min-w-0">
            Client: <strong className="text-slate-900">{clientName}</strong> <span className="text-slate-400">({clientEmail})</span>
          </div>
          <div className="text-[10px] sm:text-[11px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 shrink-0">
            Mandatory Intake Assent · Clickwrap Binding
          </div>
        </div>

        {/* Scrollable Terms Content — flex-1 min-h-0 ensures it scrolls smoothly on any screen height */}
        <div className="p-4 sm:p-6 md:p-8 flex-1 min-h-0 overflow-y-auto space-y-4 sm:space-y-6 text-xs sm:text-sm text-slate-700 leading-relaxed bg-white overscroll-contain">
          <div className="p-3 sm:p-3.5 bg-[#FAF9F6] rounded-xl border border-slate-200 text-[11px] sm:text-xs text-slate-600">
            <strong className="text-slate-900">Important Notice:</strong> By accepting below, you formalize our service turnaround timeline and fair-use revision boundaries. This ensures dedicated, high-touch calibration for your career documentation.
          </div>

          {SLA_AGREEMENT_SECTIONS.map((section, idx) => (
            <div key={idx} className="space-y-1.5 sm:space-y-2 border-b border-slate-100 pb-3.5 sm:pb-4 last:border-b-0">
              <h3 className="text-xs sm:text-sm md:text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="text-[#B8935B] font-black">§</span> {section.title}
              </h3>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">{section.content}</p>
              {section.subpoints && (
                <ul className="list-disc pl-5 space-y-1 text-slate-600 text-xs sm:text-sm mt-1">
                  {section.subpoints.map((pt, pIdx) => (
                    <li key={pIdx} className="leading-relaxed">{pt}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {/* Footer with Acceptance Checkbox and Action Button */}
        <div className="bg-[#FAF9F6] border-t border-slate-200 px-4 sm:px-8 py-3.5 sm:py-4.5 flex-shrink-0 space-y-3 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
          {error && (
            <div className="p-2 sm:p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2 animate-shake">
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}

          <label className="flex items-start gap-2.5 sm:gap-3 cursor-pointer group select-none p-2 sm:p-2.5 rounded-xl border border-slate-200/80 bg-white hover:border-[#B8935B]/50 transition-colors">
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 sm:w-4.5 sm:h-4.5 rounded border-slate-300 text-[#B8935B] focus:ring-[#B8935B] transition-all cursor-pointer accent-[#B8935B] shrink-0"
            />
            <span className="text-[11px] sm:text-xs md:text-sm text-slate-800 leading-snug">
              I have read, understood, and accept the <strong className="text-slate-950 font-bold">Catalyst Master Services Agreement &amp; Delivery SLAs</strong> ({CURRENT_SLA_VERSION}). I understand that work commences immediately and the delivery clock begins upon submission of my intake forms.
            </span>
          </label>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-0.5">
            <span className="text-[10px] sm:text-[11px] text-slate-400 order-2 sm:order-1 text-center sm:text-left flex items-center gap-1">
              <span>🔒</span>
              <span>Timestamp, IP address, and digital checksum will be cryptographically logged.</span>
            </span>
            <button
              onClick={handleAccept}
              disabled={!agreed || submitting}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#B8935B] hover:bg-[#9A7540] active:scale-98 text-white text-xs sm:text-sm font-bold uppercase tracking-wider transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-2 flex items-center justify-center gap-2"
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
