'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import { IconUser, IconRefresh, IconX } from '@/components/Icons';

interface Contact {
  id: string;
  displayId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  jobTitle: string | null;
  contactSource: string | null;
  createdAt: string;
}

interface MergeReview {
  id: string;
  sourceContact: Contact;
  targetContact: Contact;
  confidenceScore: number;
  reason: string;
  createdAt: string;
}

export default function MergeQueuePage() {
  const [reviews, setReviews] = useState<MergeReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/contacts/merge-queue');
      if (res.ok) {
        const data = await res.json();
        setReviews(data.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const resolve = async (reviewId: string, action: 'MERGE' | 'SPLIT') => {
    if (action === 'MERGE' && !confirm('Confirm merge? The source contact will be archived.')) return;
    setProcessing(reviewId);
    try {
      const res = await fetch('/api/admin/contacts/merge-resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, action }),
      });
      if (res.ok) {
        setReviews(prev => prev.filter(r => r.id !== reviewId));
      } else {
        const err = await res.json();
        alert(err.error || 'Action failed');
      }
    } catch {
      alert('Network error');
    } finally {
      setProcessing(null);
    }
  };

  const scoreColor = (score: number) =>
    score >= 80 ? '#ef4444' : score >= 60 ? '#f59e0b' : '#6b7280';

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Duplicate Merge Queue</h1>
            <p className="text-slate-500 mt-1">
              {loading ? 'Loading...' : `${reviews.length} pending review${reviews.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={fetchQueue}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <IconRefresh size={15} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card p-6 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
                <div className="h-3 bg-slate-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="card p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4 text-slate-300">
              <IconUser size={28} />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Queue is clear</h3>
            <p className="text-slate-500 text-sm mt-1">No duplicate contact pairs awaiting review.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map(review => (
              <div key={review.id} className="card overflow-hidden">
                {/* Header strip */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-slate-50">
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
                      style={{ background: scoreColor(review.confidenceScore) }}
                    >
                      {review.confidenceScore}% match
                    </span>
                    <span className="text-xs text-slate-500">{review.reason}</span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Contacts side-by-side */}
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                  {[
                    { label: 'Source (will be archived on merge)', contact: review.sourceContact },
                    { label: 'Target (kept as primary)', contact: review.targetContact },
                  ].map(({ label, contact }) => (
                    <div key={contact.id} className="p-6">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">{label}</div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                          {contact.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{contact.name}</div>
                          <div className="text-xs text-slate-400 font-mono">{contact.displayId || '—'}</div>
                        </div>
                      </div>
                      <dl className="space-y-1.5 text-sm">
                        {contact.email && (
                          <div className="flex gap-2">
                            <dt className="text-slate-400 w-16 flex-shrink-0">Email</dt>
                            <dd className="text-slate-700 font-medium truncate">{contact.email}</dd>
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex gap-2">
                            <dt className="text-slate-400 w-16 flex-shrink-0">Phone</dt>
                            <dd className="text-slate-700">{contact.phone}</dd>
                          </div>
                        )}
                        {contact.companyName && (
                          <div className="flex gap-2">
                            <dt className="text-slate-400 w-16 flex-shrink-0">Company</dt>
                            <dd className="text-slate-700">{contact.companyName}</dd>
                          </div>
                        )}
                        {contact.jobTitle && (
                          <div className="flex gap-2">
                            <dt className="text-slate-400 w-16 flex-shrink-0">Title</dt>
                            <dd className="text-slate-700">{contact.jobTitle}</dd>
                          </div>
                        )}
                        {contact.contactSource && (
                          <div className="flex gap-2">
                            <dt className="text-slate-400 w-16 flex-shrink-0">Source</dt>
                            <dd className="text-slate-600">{contact.contactSource.replace(/_/g, ' ')}</dd>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <dt className="text-slate-400 w-16 flex-shrink-0">Created</dt>
                          <dd className="text-slate-500">{new Date(contact.createdAt).toLocaleDateString()}</dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                  <button
                    onClick={() => resolve(review.id, 'SPLIT')}
                    disabled={processing === review.id}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  >
                    <IconX size={14} /> Keep Separate
                  </button>
                  <button
                    onClick={() => resolve(review.id, 'MERGE')}
                    disabled={processing === review.id}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors shadow-sm"
                  >
                    Merge Contacts
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
