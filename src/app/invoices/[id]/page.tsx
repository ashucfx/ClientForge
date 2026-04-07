'use client';
// src/app/invoices/[id]/page.tsx

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import type { InvoiceData, InvoiceStatus } from '@/types';
import { CLIENT_TYPE_LABELS, formatCurrency, SERVICE_DESCRIPTIONS } from '@/lib/pricing';

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const map = {
    PAID: { label: 'PAID', dot: '#3FBD8B', bg: '#e6f9f1', text: '#1a6b4a' },
    PENDING: { label: 'PENDING', dot: '#f59e0b', bg: '#fef3c7', text: '#92400e' },
    EXPIRED: { label: 'EXPIRED', dot: '#9ca3af', bg: '#f3f4f6', text: '#374151' },
    CANCELLED: { label: 'CANCELLED', dot: '#ef4444', bg: '#fee2e2', text: '#991b1b' },
  };
  const s = map[status] ?? map.PENDING;
  return (
    <span style={{ background: s.bg, color: s.text }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
      <span style={{ background: s.dot }} className="w-2 h-2 rounded-full" />
      {s.label}
    </span>
  );
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const isJustCreated = searchParams.get('created') === 'true';

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);
  const [showSuccess, setShowSuccess] = useState(isJustCreated);

  useEffect(() => {
    fetch(`/api/invoices/${params.id}`)
      .then(r => r.json())
      .then(d => { setInvoice(d.invoice); setLoading(false); });
  }, [params.id]);

  useEffect(() => {
    if (showSuccess) {
      const t = setTimeout(() => setShowSuccess(false), 5000);
      return () => clearTimeout(t);
    }
  }, [showSuccess]);

  const handleResend = async () => {
    setResending(true);
    const res = await fetch(`/api/invoices/${invoice!.id}/resend-email`, { method: 'POST' });
    if (res.ok) alert('Email resent to ' + invoice!.clientEmail);
    else alert('Failed to resend email');
    setResending(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f0f4ff' }}>
        <div style={{ color: '#1f56d4' }} className="font-semibold">Loading invoice...</div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f0f4ff' }}>
        <div className="text-center">
          <div className="text-5xl mb-3">😕</div>
          <div className="text-gray-600 font-medium">Invoice not found</div>
          <Link href="/" className="text-blue-600 hover:underline text-sm mt-2 inline-block">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const fmt = (n: number) => formatCurrency(n, invoice.currencySymbol);
  const desc = SERVICE_DESCRIPTIONS[invoice.clientType];

  return (
    <div className="min-h-screen" style={{ background: '#f0f4ff' }}>
      <div className="flex">
        {/* SIDEBAR */}
        <aside style={{ background: '#0f1c3d', minHeight: '100vh' }} className="w-60 flex-shrink-0 fixed left-0 top-0 bottom-0">
          <div className="px-6 py-6 border-b border-white/10">
            <Link href="/" className="text-2xl font-extrabold text-white tracking-tight">
              Ripple<span style={{ color: '#3FBD8B' }}>Nexus</span>
            </Link>
            <div className="text-xs text-white/40 mt-0.5">Invoice System</div>
          </div>
          <nav className="px-3 py-4 space-y-1">
            <Link href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all">
              <span>📊</span> Dashboard
            </Link>
            <Link href="/invoices/new" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all">
              <span>➕</span> New Invoice
            </Link>
          </nav>
        </aside>

        <main className="ml-60 flex-1 p-8 animate-page">
          {/* Success Banner */}
          {showSuccess && (
            <div style={{ background: '#e6f9f1', borderColor: '#3FBD8B', color: '#1a6b4a' }}
              className="border rounded-2xl px-5 py-4 flex items-center gap-3 mb-6">
              <span className="text-2xl">✅</span>
              <div>
                <div className="font-bold">Invoice Created Successfully!</div>
                <div className="text-sm opacity-80">Email sent to {invoice.clientEmail} · Payment link ready</div>
              </div>
            </div>
          )}

          {/* Back + Actions */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors text-sm">← Dashboard</Link>
              <span className="text-gray-300">/</span>
              <span className="text-sm font-semibold mono" style={{ color: '#1f56d4' }}>{invoice.invoiceNumber}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleResend}
                disabled={resending}
                style={{ borderColor: '#e8eeff', color: '#4a5568' }}
                className="px-4 py-2 border rounded-xl text-sm font-semibold hover:border-blue-300 transition-colors disabled:opacity-50"
              >
                {resending ? '⏳ Sending...' : '📧 Resend Email'}
              </button>
              {invoice.razorpayLinkUrl && (
                <a
                  href={invoice.razorpayLinkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ background: '#3FBD8B', color: '#fff' }}
                  className="px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
                >
                  💳 Payment Link ↗
                </a>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* INVOICE CARD */}
            <div className="col-span-2">
              {/* THE INVOICE */}
              <div style={{ borderColor: '#e8eeff', boxShadow: '0 4px 40px rgba(31,86,212,0.08)' }} className="bg-white rounded-2xl border overflow-hidden">
                {/* Invoice Header */}
                <div style={{ background: 'linear-gradient(135deg, #0f1c3d 0%, #1f56d4 100%)' }} className="p-8">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-3xl font-extrabold text-white tracking-tight">
                        Ripple<span style={{ color: '#3FBD8B' }}>Nexus</span>
                      </div>
                      <div className="text-white/50 text-xs mt-1">Career Acceleration Platform</div>
                      <div className="text-white/40 text-xs mt-3">support@ripplenexus.com</div>
                      <div className="text-white/40 text-xs">www.ripplenexus.com</div>
                    </div>
                    <div className="text-right">
                      <div style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.15)' }} className="rounded-xl p-4">
                        <div className="text-white/50 text-xs uppercase tracking-widest">Invoice</div>
                        <div className="text-white text-2xl font-extrabold mono mt-1">{invoice.invoiceNumber}</div>
                        <div style={{ background: invoice.status === 'PAID' ? '#3FBD8B' : '#f59e0b', color: '#fff' }} className="text-xs font-bold px-2.5 py-1 rounded-full mt-2 inline-block">
                          {invoice.status}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-3 gap-4 mt-6">
                    {[
                      ['Invoice Date', format(new Date(invoice.invoiceDate), 'dd MMM yyyy')],
                      ['Due Date', format(new Date(invoice.dueDate), 'dd MMM yyyy')],
                      ['Currency', `${invoice.currency} (${invoice.currencySymbol})`],
                    ].map(([label, value]) => (
                      <div key={label} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 14px' }}>
                        <div className="text-white/40 text-xs uppercase tracking-wider">{label}</div>
                        <div className="text-white font-semibold text-sm mt-0.5">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Client Details */}
                <div style={{ background: '#f8faff', borderBottom: '1px solid #e8eeff' }} className="px-8 py-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Bill To</div>
                      <div className="font-bold text-base" style={{ color: '#0f1c3d' }}>{invoice.clientName}</div>
                      <div className="text-sm text-gray-500 mt-0.5">{invoice.clientEmail}</div>
                      <div className="text-sm text-gray-500">{invoice.clientPhone}</div>
                      <div className="text-sm text-gray-500">{invoice.country}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Package Details</div>
                      <div style={{ background: '#e8f0fe', color: '#1f56d4' }} className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-2">
                        {CLIENT_TYPE_LABELS[invoice.clientType]}
                      </div>
                      <div className="text-xs text-gray-400">
                        Exchange Rate: 1 INR = {invoice.exchangeRate.toFixed(5)} {invoice.currency}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Services Table */}
                <div className="px-8 py-6">
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Services</div>
                  <table className="w-full">
                    <thead>
                      <tr style={{ background: '#f0f4ff', borderRadius: 8 }}>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 rounded-l-lg">Service</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400">Description</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400 rounded-r-lg">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.resumeConverted > 0 && (
                        <tr style={{ borderBottom: '1px solid #f0f4ff' }}>
                          <td className="px-4 py-4 align-top">
                            <div className="font-semibold text-sm" style={{ color: '#0f1c3d' }}>📄 Resume Writing</div>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="text-xs text-gray-400 leading-relaxed max-w-xs">{desc.resume}</div>
                          </td>
                          <td className="px-4 py-4 text-right align-top">
                            <div className="font-bold text-sm" style={{ color: '#0f1c3d' }}>{fmt(invoice.resumeConverted)}</div>
                            <div className="text-xs text-gray-300 mono">₹{invoice.resumeBaseInr}</div>
                          </td>
                        </tr>
                      )}
                      {invoice.linkedinConverted > 0 && (
                        <tr style={{ borderBottom: '1px solid #f0f4ff' }}>
                          <td className="px-4 py-4 align-top">
                            <div className="font-semibold text-sm" style={{ color: '#0f1c3d' }}>🔗 LinkedIn Optimization</div>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="text-xs text-gray-400 leading-relaxed max-w-xs">{desc.linkedin}</div>
                          </td>
                          <td className="px-4 py-4 text-right align-top">
                            <div className="font-bold text-sm" style={{ color: '#0f1c3d' }}>{fmt(invoice.linkedinConverted)}</div>
                            <div className="text-xs text-gray-300 mono">₹{invoice.linkedinBaseInr}</div>
                          </td>
                        </tr>
                      )}
                      <tr style={{ borderBottom: '1px solid #f0f4ff' }}>
                        <td className="px-4 py-4 align-top">
                          <div className="font-semibold text-sm" style={{ color: '#0f1c3d' }}>✉️ Cover Letter Template</div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="text-xs text-gray-400 leading-relaxed max-w-xs">{desc.coverLetter}</div>
                        </td>
                        <td className="px-4 py-4 text-right align-top">
                          <span style={{ color: '#3FBD8B', background: '#e6f9f1' }} className="text-xs font-bold px-2.5 py-1 rounded-full">FREE</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Totals */}
                  <div className="mt-5 space-y-2 max-w-xs ml-auto">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="font-semibold" style={{ color: '#0f1c3d' }}>{fmt(invoice.subtotalConverted)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Processing Fee ({(invoice.processingFeeRate * 100).toFixed(1)}%)</span>
                      <span className="font-semibold" style={{ color: '#0f1c3d' }}>{fmt(invoice.processingFeeConverted)}</span>
                    </div>
                    <div style={{ background: 'linear-gradient(135deg,#1f56d4,#1a42a0)', borderRadius: 10 }} className="flex justify-between items-center p-3.5 mt-2">
                      <span className="text-white/80 font-semibold text-sm">Total Payable ({invoice.currency})</span>
                      <span className="text-white font-extrabold text-xl">{fmt(invoice.totalPayable)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment CTA */}
                {invoice.razorpayLinkUrl && invoice.status === 'PENDING' && (
                  <div style={{ background: '#f8faff', borderTop: '1px solid #e8eeff' }} className="px-8 py-6 text-center">
                    <div className="text-sm text-gray-500 mb-3">Secure payment via Razorpay</div>
                    <a
                      href={invoice.razorpayLinkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ background: 'linear-gradient(135deg,#1f56d4,#1a42a0)' }}
                      className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-white font-bold text-base hover:opacity-90 transition-opacity shadow-lg"
                    >
                      💳 Pay {fmt(invoice.totalPayable)} Now
                    </a>
                  </div>
                )}

                {invoice.status === 'PAID' && (
                  <div style={{ background: '#e6f9f1', borderTop: '1px solid #a7f3d0' }} className="px-8 py-5 text-center">
                    <div className="text-2xl mb-1">✅</div>
                    <div className="font-bold" style={{ color: '#1a6b4a' }}>Payment Received</div>
                    {invoice.paidAt && (
                      <div className="text-sm text-green-600 mt-0.5">
                        Paid on {format(new Date(invoice.paidAt), 'dd MMM yyyy, h:mm a')}
                      </div>
                    )}
                  </div>
                )}

                {/* Value Prop */}
                <div style={{ borderTop: '1px solid #f0f4ff' }} className="px-8 py-5">
                  <blockquote style={{ borderLeft: '3px solid #3FBD8B', background: '#f0fff8', borderRadius: '0 8px 8px 0' }} className="pl-4 pr-3 py-3 text-xs text-gray-500 italic leading-relaxed">
                    "This investment is designed to improve recruiter visibility and interview conversion — giving your career the competitive edge it deserves."
                  </blockquote>
                </div>

                {/* Terms */}
                <div style={{ background: '#f8faff', borderTop: '1px solid #e8eeff' }} className="px-8 py-4">
                  <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Terms & Conditions</div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                    {[
                      'No refund after work commences',
                      'Delivery within 2–4 business days',
                      '2 revisions included',
                      'Additional revisions are chargeable',
                      'No job placement guarantee',
                      'All data kept strictly confidential',
                    ].map(t => (
                      <div key={t} className="text-xs text-gray-400 flex items-start gap-1.5">
                        <span style={{ color: '#3FBD8B' }}>•</span> {t}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div style={{ background: '#0f1c3d' }} className="px-8 py-4 flex items-center justify-between">
                  <div className="text-sm font-bold text-white">
                    Ripple<span style={{ color: '#3FBD8B' }}>Nexus</span>
                    <span className="text-white/40 font-normal text-xs ml-2">· support@ripplenexus.com</span>
                  </div>
                  <div className="mono text-white/30 text-xs">{invoice.invoiceNumber}</div>
                </div>
              </div>
            </div>

            {/* RIGHT PANEL */}
            <div className="space-y-4">
              {/* Quick Stats */}
              <div style={{ borderColor: '#e8eeff' }} className="bg-white rounded-2xl border p-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Invoice Status</div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Status</span>
                    <StatusBadge status={invoice.status} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Email</span>
                    <span className="text-xs font-semibold text-gray-600">
                      {invoice.emailSentAt ? `Sent ${format(new Date(invoice.emailSentAt), 'dd MMM')}` : 'Not sent'}
                    </span>
                  </div>
                  {invoice.emailResendCount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Resends</span>
                      <span className="text-xs font-semibold text-gray-600">{invoice.emailResendCount}×</span>
                    </div>
                  )}
                  {invoice.razorpayLinkId && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Razorpay</span>
                      <span className="text-xs font-semibold mono text-blue-600 truncate max-w-20">{invoice.razorpayLinkId}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Amount Summary */}
              <div style={{ borderColor: '#e8eeff' }} className="bg-white rounded-2xl border p-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Financials</div>
                <div className="space-y-2.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Base (INR)</span>
                    <span className="mono font-semibold text-gray-600">₹{(invoice.resumeBaseInr + invoice.linkedinBaseInr).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Converted</span>
                    <span className="font-semibold text-gray-700">{fmt(invoice.subtotalConverted)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Fee</span>
                    <span className="font-semibold text-gray-700">{fmt(invoice.processingFeeConverted)}</span>
                  </div>
                  <div style={{ borderTop: '1px solid #f0f4ff' }} className="flex justify-between pt-2.5">
                    <span className="font-bold" style={{ color: '#1f56d4' }}>Total</span>
                    <span className="font-extrabold text-lg" style={{ color: '#1f56d4' }}>{fmt(invoice.totalPayable)}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <button
                  onClick={handleResend}
                  disabled={resending}
                  style={{ borderColor: '#e8eeff' }}
                  className="w-full py-2.5 border rounded-xl text-sm font-semibold text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-all"
                >
                  📧 {resending ? 'Sending...' : 'Resend Email'}
                </button>
                <Link
                  href="/invoices/new"
                  style={{ background: '#1f56d4' }}
                  className="block w-full py-2.5 rounded-xl text-sm font-semibold text-white text-center hover:opacity-90 transition-opacity"
                >
                  + New Invoice
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
