'use client';
// src/components/rn/PortalLinkActions.tsx
// Open / copy / regenerate a client's portal link. Generates a token on the
// fly when the project was created without one (fixes the /rn/portal/null 404).

import { useState } from 'react';

export function PortalLinkActions({ clientId, compact = false }: { clientId: string; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const getLink = async (): Promise<string | null> => {
    try {
      const res = await fetch(`/api/rn/projects/${clientId}/portal-link`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed');
      return data.url as string;
    } catch {
      return null;
    }
  };

  const openPortal = async () => {
    if (busy) return;
    setBusy(true);
    const url = await getLink();
    setBusy(false);
    if (url) window.open(url, '_blank', 'noopener');
    else alert('Could not open the portal link.');
  };

  const copyLink = async () => {
    if (busy) return;
    setBusy(true);
    const url = await getLink();
    setBusy(false);
    if (!url) { alert('Could not fetch the portal link.'); return; }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      prompt('Copy the portal link:', url);
    }
  };

  const emailInvite = async () => {
    if (busy) return;
    if (!confirm('Email the branded portal invite to this client?')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/rn/projects/${clientId}/portal-link`, { method: 'PUT' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed');
      alert('Portal invite sent.');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not send the invite.');
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async () => {
    if (busy) return;
    if (!confirm('Regenerate the portal link? The old link will stop working.')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/rn/projects/${clientId}/portal-link`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed');
      await navigator.clipboard.writeText(data.url).catch(() => {});
      alert('New portal link generated and copied to clipboard.');
    } catch {
      alert('Could not regenerate the link.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <button className="btn-secondary" onClick={openPortal} disabled={busy}
        style={{ padding: compact ? '5px 10px' : '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
        Open Portal
      </button>
      <button className="btn-secondary" onClick={copyLink} disabled={busy}
        style={{ padding: compact ? '5px 10px' : '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
        {copied ? 'Copied ✓' : 'Copy Link'}
      </button>
      {!compact && (
        <>
          <button className="btn-secondary" onClick={emailInvite} disabled={busy} title="Send the branded portal invite email"
            style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--plasma)' }}>
            Email Invite
          </button>
          <button className="btn-secondary" onClick={regenerate} disabled={busy} title="Invalidate the old link and issue a new one"
            style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Regenerate
          </button>
        </>
      )}
    </div>
  );
}
