'use client';
// src/components/AdminSlaViewModal.tsx
// Audit viewer for admin to inspect signed client Master Services Agreement & Turnaround SLAs

import React, { useState } from 'react';
import {
  CURRENT_SLA_VERSION,
  SLA_AGREEMENT_SECTIONS,
} from '@/lib/agreements/slaTerms';

interface AdminSlaViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  clientEmail: string;
  acceptedAt?: string | null;
  metadata?: Record<string, unknown> | null;
}

export function AdminSlaViewModal({
  isOpen,
  onClose,
  clientName,
  clientEmail,
  acceptedAt,
  metadata,
}: AdminSlaViewModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const version = String(metadata?.version || CURRENT_SLA_VERSION);
  const ipAddress = String(metadata?.ipAddress || 'Recorded via Client Portal');
  const userAgent = String(metadata?.userAgent || 'Browser Client Session');
  const checksum = String(metadata?.checksum || 'SHA-256 Validated Assent Digest');
  const formattedDate = acceptedAt
    ? new Date(acceptedAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : 'Executed at Onboarding';

  const copyChecksum = () => {
    void navigator.clipboard.writeText(checksum);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="bg-[#0A0B0D] px-6 py-5 border-b border-[#B8935B]/30 flex-shrink-0 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#B8935B]">
                Legal &amp; Compliance Audit Record
              </span>
              <span className="text-[10px] font-mono text-slate-300 bg-white/10 px-2 py-0.5 rounded">
                {version}
              </span>
            </div>
            <h2 className="text-xl font-serif font-bold text-white">
              Signed Master Services Agreement &amp; Turnaround SLA
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Immutable digital assent certificate &amp; fully executed client service agreement terms.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center text-sm transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Digital Execution & Assent Certificate */}
        <div className="bg-[#FBF8F3] px-6 py-4 border-b border-[#E8DDD0] flex-shrink-0 text-xs">
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="font-bold text-[#9A7540] uppercase tracking-wide flex items-center gap-1.5">
              <span>🛡️</span> Digital Assent Certificate
            </span>
            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-full text-[10px] border border-emerald-300 flex items-center gap-1">
              <span>✓</span> Legally Executed &amp; Bound
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-white p-3.5 rounded-xl border border-[#E8DDD0] shadow-2xs">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Client Name</p>
              <p className="font-bold text-slate-900 truncate mt-0.5" title={clientName}>{clientName}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assent Email</p>
              <p className="font-semibold text-slate-700 truncate mt-0.5" title={clientEmail}>{clientEmail}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Executed Timestamp</p>
              <p className="font-semibold text-slate-700 mt-0.5">{formattedDate}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">IP Address</p>
              <p className="font-mono text-slate-700 mt-0.5 truncate">{ipAddress}</p>
            </div>
          </div>

          {/* Technical Digest */}
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px]">
            <div className="truncate min-w-0 flex items-center gap-2">
              <span className="text-slate-400 font-mono text-[10px] shrink-0">SHA-256:</span>
              <span className="font-mono text-slate-600 truncate">{checksum}</span>
            </div>
            <button
              onClick={copyChecksum}
              className="text-[10px] font-bold text-[#9A7540] hover:text-[#7A5B2B] bg-white px-2.5 py-1 rounded border border-slate-200 shrink-0 self-start sm:self-auto transition-colors"
            >
              {copied ? '✓ Copied' : 'Copy Digest'}
            </button>
          </div>

          {userAgent && (
            <p className="text-[10px] text-slate-400 font-mono mt-1.5 truncate">
              User Agent: {userAgent}
            </p>
          )}
        </div>

        {/* Scrollable Agreement Terms */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Executed Agreement Clauses &amp; Terms
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              The terms below were accepted by the client prior to portal workspace access.
            </p>
          </div>

          {SLA_AGREEMENT_SECTIONS.map((section, idx) => (
            <div key={idx} className="space-y-2 text-xs">
              <h4 className="font-bold text-slate-800 text-sm">{section.title}</h4>
              <p className="text-slate-600 leading-relaxed">{section.content}</p>
              {section.subpoints && (
                <ul className="space-y-1.5 pl-4 mt-2">
                  {section.subpoints.map((pt, pIdx) => (
                    <li key={pIdx} className="text-slate-600 leading-relaxed list-disc">
                      {pt}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex-shrink-0 flex items-center justify-between gap-3">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-bold text-xs rounded-xl shadow-2xs transition-colors flex items-center gap-2"
          >
            <span>🖨️</span> Print Agreement Document
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors"
          >
            Close Audit View
          </button>
        </div>
      </div>
    </div>
  );
}
