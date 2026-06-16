'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { Check, Loader2, X } from 'lucide-react';

export default function ProposalPage() {
  const params = useParams();
  const token = params.token as string;
  const [proposal, setProposal] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [done, setDone] = useState<'accepted' | 'declined' | null>(null);
  const [email, setEmail] = useState('');

  useEffect(() => {
    fetch(`/api/public/proposal/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.proposal) {
          setProposal(d.proposal);
          setEmail((d.proposal.clientEmail as string) || '');
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  const respond = async (action: 'accept' | 'decline') => {
    setActing(true);
    try {
      const res = await fetch(`/api/public/proposal/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, email: action === 'accept' ? email : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDone(action === 'accept' ? 'accepted' : 'declined');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bone flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-gold" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-brand-bone flex items-center justify-center px-8">
        <p className="text-brand-obsidian/50">Proposal not found or expired.</p>
      </div>
    );
  }

  if (done === 'accepted') {
    return (
      <div className="min-h-screen bg-brand-bone px-8 py-16 max-w-xl mx-auto">
        <Check className="w-12 h-12 text-brand-gold mb-6" />
        <h1 className="font-serif text-heading mb-4">Proposal Accepted</h1>
        <p className="text-body text-brand-obsidian/55">
          Thank you. Our team will send your invoice and payment link shortly. Once paid, you will
          receive portal access to begin onboarding.
        </p>
      </div>
    );
  }

  if (done === 'declined') {
    return (
      <div className="min-h-screen bg-brand-bone px-8 py-16 max-w-xl mx-auto">
        <p className="text-body text-brand-obsidian/55">
          Thank you for letting us know. Feel free to reach out if your needs change.
        </p>
      </div>
    );
  }

  const lineItems = (proposal.lineItems as Array<{ description: string; lineTotal: number }>) || [];
  const deliverables = (proposal.deliverables as string[]) || [];
  const clientEmail = String(proposal.clientEmail || '').toLowerCase();

  return (
    <div className="min-h-screen bg-brand-bone">
      <header className="px-8 py-8 border-b border-brand-parchment">
        <Logo variant="horizontal" size={28} brandId="catalyst" dark={false} />
      </header>
      <main className="px-8 md:px-16 py-16 max-w-3xl mx-auto">
        <p className="text-status text-brand-gold uppercase tracking-widest mb-4">Proposal</p>
        <h1 className="font-serif text-[2rem] mb-6">{String(proposal.title)}</h1>
        <p className="text-body text-brand-obsidian/60 leading-relaxed mb-10 whitespace-pre-wrap">
          {String(proposal.scopeSummary)}
        </p>

        {deliverables.length > 0 && (
          <div className="mb-10">
            <h2 className="font-serif text-subheading mb-4">Deliverables</h2>
            <ul className="space-y-2">
              {deliverables.map((d, i) => (
                <li key={i} className="flex gap-2 text-body">
                  <Check className="w-4 h-4 text-brand-gold shrink-0 mt-1" />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="border border-brand-parchment p-6 mb-10">
          {lineItems.map((item, i) => (
            <div key={i} className="flex justify-between py-2 border-b border-brand-parchment last:border-0">
              <span>{item.description}</span>
              <span>
                {String(proposal.currencySymbol)}
                {item.lineTotal.toLocaleString()}
              </span>
            </div>
          ))}
          <div className="flex justify-between pt-4 font-semibold text-lg">
            <span>Total</span>
            <span>
              {String(proposal.currencySymbol)}
              {Number(proposal.total).toLocaleString()}
            </span>
          </div>
          <p className="text-metadata text-brand-obsidian/40 mt-2">
            Valid until {new Date(String(proposal.validUntil)).toLocaleDateString()}
          </p>
        </div>

        {['SENT', 'VIEWED'].includes(String(proposal.status)) && (
          <div className="space-y-4">
            <input
              type="email"
              placeholder="Confirm your email to accept"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-brand-parchment p-3 bg-white outline-none focus:border-brand-gold"
            />
            {clientEmail && email.trim().toLowerCase() !== clientEmail && (
              <p className="text-sm text-brand-obsidian/45">
                Use the proposal recipient email to accept this proposal.
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => respond('accept')}
                disabled={acting || !email || email.trim().toLowerCase() !== clientEmail}
                className="flex-1 bg-brand-obsidian text-brand-bone py-4 font-semibold uppercase tracking-widest disabled:opacity-50"
              >
                {acting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Accept Proposal'}
              </button>
              <button
                onClick={() => respond('decline')}
                disabled={acting}
                className="flex-1 border border-brand-parchment py-4 font-semibold uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" /> Decline
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
