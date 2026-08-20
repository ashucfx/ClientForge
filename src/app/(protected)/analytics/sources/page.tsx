'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { formatCurrency } from '@/lib/pricing';

// ── Types ─────────────────────────────────────────────────────────────────────

interface InvoiceSource {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  totalPayable: number;
  subtotalConverted: number;
  currency: string;
  currencySymbol: string;
  exchangeRate: number;
  processingFeeConverted: number;
  taxAmount: number;
  discountAmount: number;
  paidAt: string | null;
  brandId: string | null;
  paymentGateway: string | null;
  inrEquivalent: number;
  netInr: number;
  isRecent: boolean;
}

interface ManualClient {
  id: string;
  name: string;
  email: string;
  amountPaid: number;
  currency: string;
  inrEquivalent: number;
  source: 'career_manual' | 'rn_manual';
  packageType?: string | null;
  createdAt: string;
  isRecent: boolean;
}

interface FeedbackRow {
  id: string;
  npsScore: number;
  rating: number;
  communication: number;
  deliveryQuality: number;
  turnaroundTime: number;
  serviceType: string;
  comments: string | null;
  createdAt: string;
  careerClientId: string | null;
  rnClientId: string | null;
}

interface SourcesData {
  summary: {
    grandTotal: number;
    invoiceTotalInr: number;
    careerManualTotalInr: number;
    rnManualTotalInr: number;
    invoiceCount: number;
    manualCareerCount: number;
    manualRnCount: number;
    feedbackCount: number;
    lifetimeNps: number | null;
    lifetimeAvgRating: number | null;
    promoters: number;
    detractors: number;
    passives: number;
  };
  invoices: InvoiceSource[];
  manualCareer: ManualClient[];
  manualRn: ManualClient[];
  feedbacks: FeedbackRow[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtInr(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

function NpsLabel({ score }: { score: number }) {
  if (score >= 9) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">Promoter ({score})</span>;
  if (score <= 6) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">Detractor ({score})</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">Passive ({score})</span>;
}

function SectionHeader({ title, subtitle, count }: { title: string; subtitle: string; count?: number }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
      </div>
      {count !== undefined && (
        <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full">{count} records</span>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AnalyticsSourcesPage() {
  const [data, setData] = useState<SourcesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'revenue' | 'nps'>('revenue');

  useEffect(() => {
    fetch('/api/admin/analytics/sources')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-6">
          <Link href="/analytics" className="hover:text-slate-700 transition-colors">Analytics</Link>
          <span>/</span>
          <span className="text-slate-700 font-semibold">Data Sources</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600 font-black text-sm">🔍</div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Analytics Data Sources</h1>
          </div>
          <p className="text-slate-500 mt-1 ml-[52px]">
            Trace exactly where every number in your analytics dashboard comes from — every invoice, every manual client, every feedback record.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          </div>
        ) : !data ? (
          <div className="card p-12 text-center text-slate-400">Failed to load source data.</div>
        ) : (
          <div className="space-y-8">

            {/* Summary KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Revenue (INR)', value: fmtInr(data.summary.grandTotal), accent: true },
                { label: 'Portal Invoices', value: fmtInr(data.summary.invoiceTotalInr) + ` (${data.summary.invoiceCount})` },
                { label: 'Manual Clients', value: fmtInr(data.summary.careerManualTotalInr + data.summary.rnManualTotalInr) + ` (${data.summary.manualCareerCount + data.summary.manualRnCount})` },
                { label: 'Feedback Responses', value: String(data.summary.feedbackCount) },
              ].map(k => (
                <div key={k.label} className={`rounded-2xl p-4 border ${k.accent ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-slate-200'}`}>
                  <div className={`text-xs font-semibold uppercase tracking-wider mb-1 ${k.accent ? 'text-violet-200' : 'text-slate-400'}`}>{k.label}</div>
                  <div className={`text-xl font-bold ${k.accent ? 'text-white' : 'text-slate-900'}`}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* How revenue is counted explanation */}
            <div className="card p-5 border-l-4 border-l-blue-500 bg-blue-50/40">
              <h3 className="font-bold text-slate-800 mb-2">📐 How Revenue Is Calculated</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-slate-600">
                <div>
                  <div className="font-semibold text-slate-700 mb-1">Source A — Portal Invoices</div>
                  <p>All invoices with <code className="bg-slate-100 px-1 rounded">status = PAID</code>. Revenue is <strong>subtotal</strong> (excludes Razorpay fees & taxes), converted to INR using the stored exchange rate.</p>
                </div>
                <div>
                  <div className="font-semibold text-slate-700 mb-1">Source B — Manual Career Clients</div>
                  <p>Career clients onboarded directly (no portal invoice). Uses the <code className="bg-slate-100 px-1 rounded">amountPaid</code> field and their recorded currency, converted to INR.</p>
                </div>
                <div>
                  <div className="font-semibold text-slate-700 mb-1">Source C — Manual RN Clients</div>
                  <p>Same logic as Source B, for Ripple Nexus clients onboarded outside the portal.</p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
              {(['revenue', 'nps'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === tab ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab === 'revenue' ? '💰 Revenue Sources' : '⭐ NPS & Feedback'}
                </button>
              ))}
            </div>

            {activeTab === 'revenue' && (
              <div className="space-y-8">
                {/* Portal Invoices Table */}
                <div className="card p-0 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100">
                    <SectionHeader
                      title="Source A — Portal Invoices (Paid)"
                      subtitle="Every paid invoice from the portal, showing the net transactional amount (excl. fees & taxes) used for analytics."
                      count={data.summary.invoiceCount}
                    />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-left">
                          {['Invoice', 'Client', 'Currency', 'Total Paid', 'Net (excl fees)', '≈ INR (net)', 'Paid On', 'Gateway'].map(h => (
                            <th key={h} className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.invoices.map(inv => (
                          <tr key={inv.id} className={`border-t border-slate-50 hover:bg-slate-50 transition-colors ${inv.isRecent ? 'bg-emerald-50/30' : ''}`}>
                            <td className="px-4 py-3">
                              <Link href={`/invoices/${inv.id}`} className="font-mono text-blue-600 hover:underline text-xs">{inv.invoiceNumber}</Link>
                              {inv.isRecent && <span className="ml-2 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded">NEW</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-800">{inv.clientName}</div>
                              <div className="text-xs text-slate-400">{inv.clientEmail}</div>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-slate-600">{inv.currency}</td>
                            <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">
                              {inv.currencySymbol}{inv.totalPayable.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                              {inv.currencySymbol}{inv.subtotalConverted.toLocaleString()}
                              {inv.processingFeeConverted > 0 && (
                                <div className="text-[10px] text-slate-400">fee: {inv.currencySymbol}{inv.processingFeeConverted.toLocaleString()}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 font-bold text-emerald-700 whitespace-nowrap">{fmtInr(inv.netInr)}</td>
                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDate(inv.paidAt)}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${inv.paymentGateway === 'PAYPAL' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                {inv.paymentGateway ?? 'RAZORPAY'}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {data.invoices.length === 0 && (
                          <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No paid invoices yet.</td></tr>
                        )}
                      </tbody>
                      {data.invoices.length > 0 && (
                        <tfoot>
                          <tr className="bg-slate-100 border-t-2 border-slate-200">
                            <td colSpan={5} className="px-4 py-3 font-bold text-slate-700">Total (showing latest 50)</td>
                            <td className="px-4 py-3 font-black text-emerald-700">{fmtInr(data.summary.invoiceTotalInr)}</td>
                            <td colSpan={2} />
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>

                {/* Manual Clients */}
                {(data.manualCareer.length > 0 || data.manualRn.length > 0) && (
                  <div className="card p-0 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100">
                      <SectionHeader
                        title="Sources B & C — Manual Clients (No Portal Invoice)"
                        subtitle="Clients onboarded outside the portal with manually recorded payments."
                        count={data.summary.manualCareerCount + data.summary.manualRnCount}
                      />
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 text-left">
                            {['Client', 'Source', 'Amount Paid', '≈ INR', 'Onboarded'].map(h => (
                              <th key={h} className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[...data.manualCareer, ...data.manualRn].map(c => (
                            <tr key={c.id} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3">
                                <div className="font-medium text-slate-800">{c.name}</div>
                                <div className="text-xs text-slate-400">{c.email}</div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.source === 'career_manual' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>
                                  {c.source === 'career_manual' ? 'Career' : 'Ripple Nexus'}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-bold text-slate-900">{c.currency} {c.amountPaid.toLocaleString()}</td>
                              <td className="px-4 py-3 font-bold text-emerald-700">{fmtInr(c.inrEquivalent)}</td>
                              <td className="px-4 py-3 text-slate-500">{fmtDate(c.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100 border-t-2 border-slate-200">
                            <td colSpan={3} className="px-4 py-3 font-bold text-slate-700">Total</td>
                            <td className="px-4 py-3 font-black text-emerald-700">{fmtInr(data.summary.careerManualTotalInr + data.summary.rnManualTotalInr)}</td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'nps' && (
              <div className="space-y-6">
                {/* NPS Breakdown Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Lifetime NPS', value: data.summary.lifetimeNps !== null ? data.summary.lifetimeNps : '—', desc: '−100 to +100 · above 50 = excellent', accent: true },
                    { label: 'Promoters (9–10)', value: data.summary.promoters, desc: 'Likely to recommend' },
                    { label: 'Passives (7–8)', value: data.summary.passives, desc: 'Satisfied but not enthusiastic' },
                    { label: 'Detractors (0–6)', value: data.summary.detractors, desc: 'Unhappy, churn risk' },
                  ].map(k => (
                    <div key={k.label} className={`rounded-2xl p-4 border ${k.accent ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-slate-200'}`}>
                      <div className={`text-xs font-semibold uppercase tracking-wider mb-1 ${k.accent ? 'text-violet-200' : 'text-slate-400'}`}>{k.label}</div>
                      <div className={`text-2xl font-black mb-1 ${k.accent ? 'text-white' : 'text-slate-900'}`}>{String(k.value)}</div>
                      <div className={`text-xs ${k.accent ? 'text-violet-200' : 'text-slate-400'}`}>{k.desc}</div>
                    </div>
                  ))}
                </div>

                {/* NPS Formula Explanation */}
                <div className="card p-5 border-l-4 border-l-violet-500 bg-violet-50/40">
                  <h3 className="font-bold text-slate-800 mb-2">📐 How NPS Is Calculated</h3>
                  <p className="text-sm text-slate-600 mb-2">
                    NPS = <strong>% Promoters</strong> (score 9–10) − <strong>% Detractors</strong> (score 0–6). Passives (7–8) are ignored.
                  </p>
                  {data.summary.feedbackCount > 0 ? (
                    <div className="text-sm text-slate-600 font-mono bg-white rounded-lg p-3 border border-violet-100">
                      ({data.summary.promoters}/{data.summary.feedbackCount} − {data.summary.detractors}/{data.summary.feedbackCount}) × 100
                      {' = '}
                      <strong>{data.summary.lifetimeNps}</strong>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">No feedback collected yet — NPS is calculated once clients submit the post-project form.</p>
                  )}
                </div>

                {/* Feedback Table */}
                <div className="card p-0 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100">
                    <SectionHeader
                      title="All Feedback Responses"
                      subtitle="Individual feedback records from clients who completed the post-project satisfaction form."
                      count={data.summary.feedbackCount}
                    />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-left">
                          {['Date', 'Service', 'NPS Score', 'Rating', 'Communication', 'Quality', 'Turnaround', 'Comments'].map(h => (
                            <th key={h} className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.feedbacks.map(fb => (
                          <tr key={fb.id} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDate(fb.createdAt)}</td>
                            <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{fb.serviceType}</td>
                            <td className="px-4 py-3"><NpsLabel score={fb.npsScore} /></td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <span className="font-bold text-amber-600">{fb.rating}</span>
                                <span className="text-amber-400">{'★'.repeat(fb.rating)}{'☆'.repeat(5 - fb.rating)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center text-slate-600">{fb.communication}/5</td>
                            <td className="px-4 py-3 text-center text-slate-600">{fb.deliveryQuality}/5</td>
                            <td className="px-4 py-3 text-center text-slate-600">{fb.turnaroundTime}/5</td>
                            <td className="px-4 py-3 max-w-xs">
                              {fb.comments ? (
                                <p className="text-xs text-slate-500 truncate" title={fb.comments}>{fb.comments}</p>
                              ) : <span className="text-slate-300 text-xs">—</span>}
                            </td>
                          </tr>
                        ))}
                        {data.feedbacks.length === 0 && (
                          <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">No feedback submissions yet.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
