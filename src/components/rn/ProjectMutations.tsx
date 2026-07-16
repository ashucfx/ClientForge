'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/* ── Message composer with internal-note mode ─────────────────────── */
export function MessageInput({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [internal, setInternal] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!content.trim() || loading) return;
    setLoading(true);
    try {
      await fetch(`/api/rn/projects/${projectId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, internal }),
      });
      setContent('');
      router.refresh();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 14, borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button
          type="button"
          onClick={() => setInternal(false)}
          className="rn-chip"
          style={!internal ? { background: 'var(--brand-light)', borderColor: 'var(--brand)', color: 'var(--plasma)' } : undefined}
        >
          Message client
        </button>
        <button
          type="button"
          onClick={() => setInternal(true)}
          className="rn-chip"
          style={internal ? { background: 'var(--warning-bg)', borderColor: 'var(--warning)', color: 'var(--warning)' } : undefined}
        >
          Internal note
        </button>
      </div>
      <input
        type="text"
        placeholder={internal ? 'Private note — the client never sees this…' : 'Type a message to the client…'}
        className="input"
        style={{ width: '100%', padding: '12px 16px', fontSize: 13 }}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        disabled={loading}
      />
    </div>
  );
}

/* ── Advance workflow stage ───────────────────────────────────────── */
export function AdvanceStageButton({ projectId, currentStage, allStages }: { projectId: string, currentStage: string, allStages: string[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const currentIndex = allStages.indexOf(currentStage);
  const nextStage = currentIndex >= 0 && currentIndex < allStages.length - 1 ? allStages[currentIndex + 1] : null;

  if (!nextStage) return null;

  const handleAdvance = async () => {
    if (!confirm(`Advance the project to ${nextStage.replace(/_/g, ' ')}?`)) return;
    setLoading(true);
    try {
      await fetch(`/api/rn/projects/${projectId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStage: nextStage })
      });
      router.refresh();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleAdvance} disabled={loading} className="btn-secondary" style={{ padding: '8px 16px', fontSize: 12 }}>
      {loading ? 'Advancing…' : `Advance to ${nextStage.replace(/_/g, ' ')}`}
    </button>
  );
}

/* ── Real deliverable upload (signed Cloudinary) ──────────────────── */
export function UploadDeliverableButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      // 1. Signed upload params scoped to this tenant + client folder
      const sigRes = await fetch(`/api/rn/upload/signature?clientId=${projectId}`);
      const sig = await sigRes.json();
      if (!sigRes.ok) throw new Error(sig?.error ?? 'Could not authorize upload');

      // 2. Direct upload to Cloudinary
      const form = new FormData();
      form.append('file', file);
      form.append('api_key', sig.apiKey);
      form.append('timestamp', sig.timestamp);
      form.append('signature', sig.signature);
      form.append('folder', sig.folder);
      form.append('unique_filename', 'true');
      form.append('use_filename', 'true');

      const upRes = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`, {
        method: 'POST',
        body: form,
      });
      const up = await upRes.json();
      if (!upRes.ok) throw new Error(up?.error?.message ?? 'Upload failed');

      // 3. Register the deliverable
      const res = await fetch(`/api/rn/projects/${projectId}/deliverables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: file.name,
          fileUrl: up.secure_url,
          publicId: up.public_id,
          fileType: up.resource_type ?? 'auto',
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          fileCategory: 'final',
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? 'Could not save deliverable');
      }
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <button onClick={() => fileRef.current?.click()} disabled={loading} className="btn-primary" style={{ padding: '8px 16px', fontWeight: 600 }}>
        {loading ? 'Uploading…' : '+ Add Deliverable'}
      </button>
    </>
  );
}

/* ── Edit project details ─────────────────────────────────────────── */
export function EditProjectButton({
  projectId, expectedDeliveryAt, amountPaid, notes, companyName, clientName, email,
}: {
  projectId: string;
  expectedDeliveryAt: string | null;
  amountPaid: number;
  notes: string | null;
  companyName: string | null;
  clientName: string;
  email: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    expectedDeliveryAt: expectedDeliveryAt ? expectedDeliveryAt.slice(0, 10) : '',
    amountPaid: String(amountPaid ?? 0),
    notes: notes ?? '',
    companyName: companyName ?? '',
    clientName: clientName ?? '',
    email: email ?? '',
  });

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/rn/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedDeliveryAt: form.expectedDeliveryAt || null,
          amountPaid: Number(form.amountPaid) || 0,
          notes: form.notes,
          companyName: form.companyName,
          clientName: form.clientName,
          email: form.email,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? 'Save failed');
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-secondary" style={{ padding: '8px 16px', fontSize: 12 }}>
        Edit
      </button>
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,11,20,0.7)', backdropFilter: 'blur(4px)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setOpen(false)}
        >
          <div
            className="rn-panel"
            style={{ width: '100%', maxWidth: 460, padding: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Edit Project</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={label}>Client Name</label>
                  <input className="input" style={{ width: '100%', padding: '10px 14px', fontSize: 13 }} value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} />
                </div>
                <div>
                  <label style={label}>Client Email (portal login)</label>
                  <input type="email" className="input" style={{ width: '100%', padding: '10px 14px', fontSize: 13 }} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={label}>Company Name</label>
                <input className="input" style={{ width: '100%', padding: '10px 14px', fontSize: 13 }} value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={label}>Expected Delivery</label>
                  <input type="date" className="input" style={{ width: '100%', padding: '10px 14px', fontSize: 13 }} value={form.expectedDeliveryAt} onChange={e => setForm(f => ({ ...f, expectedDeliveryAt: e.target.value }))} />
                </div>
                <div>
                  <label style={label}>Budget / Paid</label>
                  <input type="number" min="0" className="input" style={{ width: '100%', padding: '10px 14px', fontSize: 13 }} value={form.amountPaid} onChange={e => setForm(f => ({ ...f, amountPaid: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={label}>Internal Notes</label>
                <textarea className="input" rows={3} style={{ width: '100%', padding: '10px 14px', fontSize: 13, resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button className="btn-secondary" style={{ padding: '9px 16px', fontSize: 13 }} onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn-primary" style={{ padding: '9px 20px', fontSize: 13 }} onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Archive / restore ────────────────────────────────────────────── */
export function ArchiveProjectButton({ projectId, lifecycleStatus }: { projectId: string; lifecycleStatus: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isActive = lifecycleStatus === 'ACTIVE';

  const toggle = async () => {
    const reason = isActive ? (prompt('Archive this project? Optional reason:') ?? null) : '';
    if (isActive && reason === null) return;
    setLoading(true);
    try {
      await fetch(`/api/rn/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isActive
          ? { lifecycleStatus: 'ARCHIVED', archiveReason: reason || '' }
          : { lifecycleStatus: 'ACTIVE' }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={toggle} disabled={loading} className="btn-secondary" style={{ padding: '8px 16px', fontSize: 12, color: isActive ? 'var(--text-tertiary)' : 'var(--success)' }}>
      {loading ? '…' : isActive ? 'Archive' : 'Restore'}
    </button>
  );
}

/* ── Admin deliverable approval controls ──────────────────────────── */
export function DeliverableAdminActions({ deliverableId, approvalStatus, fileUrl }: { deliverableId: string; approvalStatus: string; fileUrl: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const setStatus = async (status: string) => {
    setLoading(true);
    try {
      await fetch(`/api/rn/deliverables/${deliverableId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalStatus: status }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    if (!confirm('Remove this deliverable? The client will no longer see it.')) return;
    setLoading(true);
    try {
      await fetch(`/api/rn/deliverables/${deliverableId}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12, textDecoration: 'none' }}>
        View
      </a>
      {approvalStatus !== 'APPROVED' && (
        <button onClick={() => setStatus('APPROVED')} disabled={loading} className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12, color: 'var(--success)' }}>
          Approve
        </button>
      )}
      <button onClick={remove} disabled={loading} className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12, color: 'var(--danger)' }}>
        Delete
      </button>
    </div>
  );
}
