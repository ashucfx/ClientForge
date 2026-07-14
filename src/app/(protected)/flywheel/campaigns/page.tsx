'use client';

import { useState, useEffect, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import AppShell from '@/components/AppShell';
import { useBrand } from '@/components/BrandProvider';
import { getBrand } from '@/lib/brand/registry';
import {
  IconMail, IconSend, IconPlus, IconEye, IconX, IconRefresh,
  IconPlay, IconPause, IconUser, IconChevronRight, IconTrendUp, IconSearch
} from '@/components/Icons';
import {
  MARKETING_TEMPLATES, TEMPLATE_CATEGORY_LABELS, type TemplateCategory,
} from '@/lib/marketing/templates';

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  DRAFT:     { label: 'Draft',     bg: '#f1f5f9', color: '#64748b' },
  SCHEDULED: { label: 'Scheduled', bg: '#f5f3ff', color: '#8b5cf6' },
  ACTIVE:    { label: 'Active',    bg: '#ecfdf5', color: '#10b981' },
  PAUSED:    { label: 'Paused',    bg: '#fffbeb', color: '#f59e0b' },
  COMPLETED: { label: 'Completed', bg: '#eff6ff', color: '#3b82f6' },
};

interface Campaign {
  id: string; name: string; type: string; status: string; createdAt: string;
  metadata?: { audienceFilter?: string; contactIds?: string[] };
  _count: { leads: number; steps: number };
  stats?: { sent: number; opens: number; unsubs: number; openRate: number };
}
interface LeadOption { id: string; name: string; email: string; }

// ──── Content Block Types ────
type BlockType = 'heading' | 'paragraph' | 'button' | 'divider';
interface ContentBlock { id: string; type: BlockType; content: string; extra?: string; }

// One email in a campaign — a drip sequence is simply several of these, each
// sent `delayDays` after the previous one (the cron advances leads step by step).
interface EmailStep {
  id: string;
  subject: string;
  delayDays: number; // days after the PREVIOUS email (first email: 0 = immediately on launch)
  templateHtml: string | null;
  templateName: string;
  blocks: ContentBlock[];
}

const newEmailStep = (delayDays = 0): EmailStep => ({
  id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
  subject: '',
  delayDays,
  templateHtml: null,
  templateName: '',
  blocks: [
    { id: '1', type: 'heading', content: '' },
    { id: '2', type: 'paragraph', content: '' },
  ],
});

export default function FlywheelCampaigns() {
  const { activeBrand } = useBrand();
  const brand = getBrand(activeBrand === 'all' ? 'catalyst' : activeBrand);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  // Create wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [campaignName, setCampaignName] = useState('');
  const [campaignType, setCampaignType] = useState('ONE_OFF');
  // Multi-email support: each campaign is a list of emails (1 = one-off blast,
  // 2+ = drip sequence sent day by day). The editor below always edits the
  // ACTIVE email; subject/blocks/template are derived shims so the existing
  // editor JSX keeps working unchanged.
  const [emails, setEmails] = useState<EmailStep[]>([newEmailStep()]);
  const [activeEmailIdx, setActiveEmailIdx] = useState(0);
  const activeEmail = emails[Math.min(activeEmailIdx, emails.length - 1)];
  const patchActiveEmail = (patch: Partial<EmailStep>) =>
    setEmails(prev => prev.map((e, i) => (i === Math.min(activeEmailIdx, prev.length - 1) ? { ...e, ...patch } : e)));
  const subject = activeEmail.subject;
  const setSubject = (v: string) => patchActiveEmail({ subject: v });
  const blocks = activeEmail.blocks;
  const setBlocks = (v: ContentBlock[]) => patchActiveEmail({ blocks: v });
  const templateHtml = activeEmail.templateHtml;
  const templateName = activeEmail.templateName;
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryCat, setGalleryCat] = useState<TemplateCategory | 'ALL'>('ALL');
  const [galleryPreviewId, setGalleryPreviewId] = useState<string | null>(null);
  const [audienceFilter, setAudienceFilter] = useState('ALL');
  const [audienceCount, setAudienceCount] = useState(0);
  const [pickedLeads, setPickedLeads] = useState<LeadOption[]>([]);
  const [leadSearch, setLeadSearch] = useState('');
  const [leadSearchResults, setLeadSearchResults] = useState<LeadOption[]>([]);
  const [leadSearching, setLeadSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Detail / dispatch / mutate
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);

  // Launch-time lead picker: review the resolved audience, select/deselect
  // individual leads, then send only to the checked ones.
  const [picker, setPicker] = useState<{ campaignId: string; campaignName: string; leads: LeadOption[] } | null>(null);
  const [pickerChecked, setPickerChecked] = useState<Set<string>>(new Set());
  const [pickerSearch, setPickerSearch] = useState('');
  // Send timing: NOW = enrol + trigger delivery immediately; SCHEDULE = cron launches at the chosen time
  const [pickerTiming, setPickerTiming] = useState<'NOW' | 'SCHEDULE'>('NOW');
  const [pickerScheduleAt, setPickerScheduleAt] = useState('');

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/flywheel/campaigns?brandId=${activeBrand === 'all' ? 'catalyst' : activeBrand}`);
      if (res.ok) {
        const json = await res.json();
        setCampaigns(json.data || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [activeBrand]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  // Audience count estimation
  useEffect(() => {
    if (!wizardOpen) return;
    if (audienceFilter === 'PICK') { setAudienceCount(pickedLeads.length); return; }
    const estimateAudience = async () => {
      try {
        const params = new URLSearchParams();
        if (audienceFilter !== 'ALL') params.set('stage', audienceFilter);
        const res = await fetch(`/api/admin/flywheel/leads?${params}&pageSize=1`);
        if (res.ok) {
          const data = await res.json();
          setAudienceCount(data.pagination?.total || 0);
        }
      } catch { /* silent */ }
    };
    estimateAudience();
  }, [audienceFilter, pickedLeads, wizardOpen]);

  // Lead search for hand-pick mode
  useEffect(() => {
    if (audienceFilter !== 'PICK' || !leadSearch.trim()) { setLeadSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setLeadSearching(true);
      try {
        const res = await fetch(`/api/admin/flywheel/leads?search=${encodeURIComponent(leadSearch)}&pageSize=10`);
        if (res.ok) {
          const data = await res.json();
          const list: LeadOption[] = (data.data || []).map((c: any) => ({ id: c.id, name: c.name, email: c.email }));
          setLeadSearchResults(list.filter(l => !pickedLeads.find(p => p.id === l.id)));
        }
      } catch { /* silent */ } finally { setLeadSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [leadSearch, audienceFilter, pickedLeads]);

  // ── Block editor helpers ──
  const addBlock = (type: BlockType) => {
    const defaults: Record<BlockType, string> = { heading: 'Section Title', paragraph: 'Your content here...', button: 'Click Here', divider: '' };
    setBlocks([...blocks, { id: Date.now().toString(), type, content: defaults[type] }]);
  };
  const updateBlock = (id: string, field: string, value: string) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, [field]: value } : b));
  };
  const removeBlock = (id: string) => setBlocks(blocks.filter(b => b.id !== id));
  const moveBlock = (idx: number, dir: number) => {
    const next = [...blocks];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setBlocks(next);
  };

  // Build HTML from blocks
  const resolvePlaceholders = (text: string) =>
    text.replace(/\{brand\}/gi, brand.name);

  const blocksToHtml = (list: ContentBlock[] = blocks) => list.map(b => {
    const content = resolvePlaceholders(b.content);
    switch (b.type) {
      case 'heading':   return content ? `<h2 style="font-size:20px;font-weight:700;color:#1e293b;margin:24px 0 8px;">${content}</h2>` : '';
      case 'paragraph': return content ? `<p style="font-size:15px;line-height:1.7;color:#475569;margin:12px 0;">${content}</p>` : '';
      case 'button':    return content ? `<p style="text-align:center;margin:24px 0;"><a href="${b.extra || '#'}" style="display:inline-block;padding:12px 28px;background:${brand.primaryColor};color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">${content}</a></p>` : '';
      case 'divider':   return `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />`;
      default: return '';
    }
  }).join('\n');

  const buildEmailPreview = (email: EmailStep = activeEmail) => {
    const bodyHtml = email.templateHtml ?? blocksToHtml(email.blocks);
    const isCatalyst = brand.id === 'catalyst';
    const logoHtml = brand.logoEmailHtml(44);
    const nameColor = isCatalyst ? '#F4F1EB' : '#F4F5FA';
    const taglineColor = isCatalyst ? 'rgba(184,147,91,0.80)' : 'rgba(34,211,238,0.80)';
    const footerBg = isCatalyst ? '#F5F3EE' : '#12141F';
    const footerBorder = isCatalyst ? '#EDE9DF' : '#1E2030';
    const footerText = isCatalyst ? '#a0926c' : '#6b7280';

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:20px;background:${brand.emailBg};font-family:Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center">
<table role="presentation" width="580" cellpadding="0" cellspacing="0"
  style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(10,11,13,0.14);">

  <!-- Header -->
  <tr>
    <td style="background:${brand.gradient};padding:26px 32px 22px;">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td valign="middle" style="padding-right:12px;">${logoHtml}</td>
          <td valign="middle">
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:17px;font-weight:400;color:${nameColor};letter-spacing:2px;">${brand.name.toUpperCase()}</div>
            <div style="font-family:Helvetica,Arial,sans-serif;font-size:9px;color:${taglineColor};letter-spacing:1.8px;text-transform:uppercase;margin-top:4px;">${brand.tagline}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Accent bar -->
  <tr><td height="3" style="background:${brand.accentBar};font-size:0;line-height:0;">&nbsp;</td></tr>

  <!-- Body -->
  <tr>
    <td style="padding:32px 36px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#4a5568;line-height:1.75;">
      ${bodyHtml}
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:${footerBg};padding:20px 36px;border-top:1px solid ${footerBorder};border-radius:0 0 16px 16px;">
      <div style="font-size:10px;color:${footerText};line-height:1.6;text-align:center;">
        You are receiving this email because you opted in at ${brand.name}.<br/>
        <a href="#" style="color:${footerText};text-decoration:underline;">Unsubscribe</a>
        &nbsp;·&nbsp;
        <a href="${brand.websiteUrl}" style="color:${footerText};text-decoration:underline;">${brand.websiteUrl.replace('https://', '')}</a>
      </div>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body></html>`;
  };

  // An email has content if it uses a template or any block has text
  const emailHasContent = (e: EmailStep) =>
    !!e.templateHtml || e.blocks.some(b => b.type === 'divider' || b.content.trim().length > 0);

  // Create campaign — one step per email; 2+ emails automatically make it a drip
  const handleCreate = async () => {
    if (!campaignName) return;
    const invalid = emails.findIndex(e => !e.subject.trim() || !emailHasContent(e));
    if (invalid !== -1) {
      setActiveEmailIdx(invalid);
      alert(`Email ${invalid + 1} needs a subject and some content before creating.`);
      return;
    }
    setSaving(true);
    try {
      const steps = emails.map((e, i) => ({
        subject: e.subject,
        contentHtml: e.templateHtml ?? blocksToHtml(e.blocks),
        delayHours: i === 0 ? 0 : Math.max(1, Math.round(e.delayDays * 24)),
      }));
      const metadata = audienceFilter === 'PICK'
        ? { audienceFilter: 'PICK', contactIds: pickedLeads.map(l => l.id) }
        : { audienceFilter };

      // When editing a hand-picked campaign, the wizard doesn't reload the
      // saved lead list — sending an empty PICK list would WIPE it. Omit
      // metadata in that case so the saved audience is preserved.
      const omitMetadata = !!editingId && audienceFilter === 'PICK' && pickedLeads.length === 0;

      const res = editingId
        ? await fetch(`/api/admin/flywheel/campaigns/${editingId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: campaignName, steps, sendNewNow: sendFollowupNow, ...(omitMetadata ? {} : { metadata }) }),
          })
        : await fetch('/api/admin/flywheel/campaigns', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: campaignName,
              type: emails.length > 1 ? 'DRIP' : campaignType,
              brandId: activeBrand === 'all' ? 'catalyst' : activeBrand,
              metadata, steps,
            }),
          });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const wasEditing = !!editingId;
        const triggerNow = wasEditing && sendFollowupNow && data.appendedFollowup;
        setWizardOpen(false);
        resetWizard();
        fetchCampaigns();
        if (triggerNow) {
          // Deliver the just-added follow-up right away
          fetch('/api/admin/flywheel/cron/process-campaigns')
            .then(r => r.json()).then(p => setDispatchResult(
              `Follow-up saved. ${typeof p.processedCount === 'number' ? `${p.processedCount} email(s) sent now.` : 'Delivery triggered.'}`))
            .catch(() => setDispatchResult('Follow-up saved — it will send on the next processor run.'));
        }
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Failed to save campaign: ${err.error || res.statusText}`);
      }
    } finally { setSaving(false); }
  };

  const resetWizard = () => {
    setWizardStep(1); setCampaignName(''); setCampaignType('ONE_OFF');
    setAudienceFilter('ALL');
    setPickedLeads([]); setLeadSearch(''); setLeadSearchResults([]);
    setGalleryOpen(false); setGalleryCat('ALL');
    setEmails([newEmailStep()]); setActiveEmailIdx(0);
    setEditingId(null); setSendFollowupNow(false);
  };

  // ── Multi-email (drip) helpers ──
  const addEmailStep = () => {
    setEmails(prev => [...prev, newEmailStep(2)]); // sensible default: 2 days after previous
    setActiveEmailIdx(emails.length);
    if (campaignType === 'ONE_OFF') setCampaignType('DRIP');
  };
  const removeEmailStep = (idx: number) => {
    if (emails.length <= 1) return;
    setEmails(prev => prev.filter((_, i) => i !== idx));
    setActiveEmailIdx(prev => Math.max(0, prev >= idx ? prev - 1 : prev));
  };

  // Load a prebuilt template into the ACTIVE email
  const applyTemplate = (tpl: typeof MARKETING_TEMPLATES[number]) => {
    patchActiveEmail({ templateHtml: tpl.bodyHtml, templateName: tpl.name, subject: tpl.subject });
    if (!campaignName.trim()) setCampaignName(tpl.name);
    setGalleryOpen(false);
  };
  const clearTemplate = () => patchActiveEmail({ templateHtml: null, templateName: '' });

  // ── Edit / duplicate / test-send / export ──
  const [editingId, setEditingId] = useState<string | null>(null);
  // When editing a live campaign, deliver any newly-added follow-up immediately
  const [sendFollowupNow, setSendFollowupNow] = useState(false);
  const [testSendFor, setTestSendFor] = useState<Campaign | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testStepIdx, setTestStepIdx] = useState(0);
  const [testSending, setTestSending] = useState(false);

  // Enrolled-leads panel
  type EnrolledLead = { leadId: string; name: string; email: string; status: string; stepIndex: number };
  const [enrolled, setEnrolled] = useState<EnrolledLead[] | null>(null);
  const [enrolledLoading, setEnrolledLoading] = useState(false);
  const [enrolledFor, setEnrolledFor] = useState<string | null>(null);

  const fetchEnrolled = async (campaignId: string) => {
    setEnrolledFor(campaignId); setEnrolledLoading(true); setEnrolled(null);
    try {
      const res = await fetch(`/api/admin/flywheel/campaigns/${campaignId}/leads`);
      if (res.ok) { const d = await res.json(); setEnrolled(d.leads || []); }
      else setEnrolled([]);
    } catch { setEnrolled([]); }
    finally { setEnrolledLoading(false); }
  };
  const leadAction = async (campaignId: string, leadId: string, action: 'pause' | 'resume' | 'remove') => {
    const res = await fetch(`/api/admin/flywheel/campaigns/${campaignId}/leads`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, action }),
    });
    if (res.ok) fetchEnrolled(campaignId);
  };

  const handleEdit = async (campaign: Campaign) => {
    try {
      const res = await fetch(`/api/admin/flywheel/campaigns/${campaign.id}`);
      if (!res.ok) { alert('Could not load campaign for editing.'); return; }
      const d = await res.json();
      const steps: { id: string; subject: string; contentHtml: string; delayHours: number }[] = d.steps ?? [];
      setEditingId(campaign.id);
      setCampaignName(campaign.name);
      setCampaignType(steps.length > 1 ? 'DRIP' : campaign.type);
      setAudienceFilter(campaign.metadata?.audienceFilter ?? 'ALL');
      setPickedLeads([]);
      setEmails(steps.length ? steps.map((s, i) => ({
        id: s.id || (Date.now() + i).toString(),
        subject: s.subject,
        delayDays: i === 0 ? 0 : Math.max(1, Math.round((s.delayHours || 24) / 24)),
        templateHtml: s.contentHtml,           // saved content shown as-is
        templateName: 'Saved content',
        blocks: [{ id: '1', type: 'heading', content: '' }, { id: '2', type: 'paragraph', content: '' }],
      })) : [newEmailStep()]);
      setActiveEmailIdx(0);
      setSelectedCampaign(null);
      setGalleryOpen(false);
      setWizardStep(3);          // jump straight to content
      setWizardOpen(true);
    } catch { alert('Network error while loading campaign.'); }
  };

  const handleDuplicate = async (campaign: Campaign) => {
    setMutating(true);
    try {
      const res = await fetch(`/api/admin/flywheel/campaigns/${campaign.id}/duplicate`, { method: 'POST' });
      if (res.ok) { setDispatchResult(`Duplicated "${campaign.name}" as a new draft.`); fetchCampaigns(); }
      else alert('Could not duplicate campaign.');
    } finally { setMutating(false); }
  };

  const handleTestSend = async () => {
    if (!testSendFor) return;
    setTestSending(true);
    try {
      const res = await fetch(`/api/admin/flywheel/campaigns/${testSendFor.id}/test-send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testEmail.trim(), stepIndex: testStepIdx }),
      });
      const d = await res.json();
      if (d.success) { alert(d.message || 'Test email sent.'); setTestSendFor(null); setTestEmail(''); }
      else alert(d.error || 'Could not send test email.');
    } catch { alert('Network error.'); }
    finally { setTestSending(false); }
  };

  // Launch / add-leads — resolve the audience into a reviewable list first, so
  // the admin can select/deselect exactly who receives the campaign.
  const handleDispatch = async (campaignId: string) => {
    setDispatching(true); setDispatchResult(null);
    try {
      const campaign = campaigns.find(c => c.id === campaignId) ?? selectedCampaign;
      const savedFilter = campaign?.metadata?.audienceFilter ?? 'ALL';

      const params = new URLSearchParams({ pageSize: '1000' });
      if (savedFilter !== 'ALL' && savedFilter !== 'PICK') params.set('stage', savedFilter);
      const audienceRes = await fetch(`/api/admin/flywheel/leads?${params}`);
      if (!audienceRes.ok) { setDispatchResult('Error: Could not resolve audience.'); return; }
      const audienceData = await audienceRes.json();
      const leads: LeadOption[] = (audienceData.contacts || audienceData.data || [])
        .map((c: any) => ({ id: c.id, name: c.name ?? '(no name)', email: c.email ?? '' }));

      if (leads.length === 0) { setDispatchResult('No leads found — create leads in Funnel → Leads first.'); return; }

      // The picker always shows the FULL list so you can add anyone. For
      // hand-picked campaigns the previously saved leads come pre-checked;
      // otherwise everyone starts checked. Dedup on the server means leads
      // already in the campaign are never re-sent regardless of selection.
      const savedIds = new Set(campaign?.metadata?.contactIds ?? []);
      const preChecked = savedFilter === 'PICK' && savedIds.size > 0
        ? leads.filter(l => savedIds.has(l.id)).map(l => l.id)
        : leads.map(l => l.id);

      setPicker({ campaignId, campaignName: campaign?.name ?? 'Campaign', leads });
      setPickerChecked(new Set(preChecked));
      setPickerSearch('');
      setPickerTiming('NOW');
      // Default schedule slot: tomorrow 10:00 local, as a datetime-local value
      const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0);
      const pad = (n: number) => String(n).padStart(2, '0');
      setPickerScheduleAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    } catch { setDispatchResult('An error occurred.'); }
    finally { setDispatching(false); }
  };

  const confirmDispatch = async () => {
    if (!picker || pickerChecked.size === 0) return;
    if (pickerTiming === 'SCHEDULE' && !pickerScheduleAt) return;
    setDispatching(true);
    try {
      const res = await fetch(`/api/admin/flywheel/campaigns/${picker.campaignId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactIds: Array.from(pickerChecked),
          ...(pickerTiming === 'SCHEDULE' ? { scheduledAt: new Date(pickerScheduleAt).toISOString() } : {}),
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (pickerTiming === 'NOW' && !data.scheduled) {
          // Fire the processor so step-1 emails go out immediately instead of
          // waiting for the next cron run.
          setDispatchResult(`${data.message || 'Enrolled.'} Sending now…`);
          setPicker(null);
          try {
            const proc = await fetch('/api/admin/flywheel/cron/process-campaigns');
            const p = await proc.json().catch(() => ({}));
            setDispatchResult(
              `${data.message || 'Enrolled.'} ${typeof p.processedCount === 'number' ? `${p.processedCount} email${p.processedCount === 1 ? '' : 's'} sent now.` : 'Delivery triggered.'}`
            );
          } catch { /* enrolment succeeded; cron will deliver if trigger failed */ }
        } else {
          setDispatchResult(data.message || 'Scheduled.');
          setPicker(null);
        }
        fetchCampaigns();
      } else { setDispatchResult(`Error: ${data.error || 'Failed to dispatch'}`); setPicker(null); }
    } catch { setDispatchResult('An error occurred.'); setPicker(null); }
    finally { setDispatching(false); }
  };

  const cancelSchedule = async (campaignId: string) => {
    setMutating(true);
    await fetch(`/api/admin/flywheel/campaigns/${campaignId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DRAFT' }),
    });
    setDispatchResult('Schedule cancelled — campaign is back to draft.');
    await fetchCampaigns();
    setMutating(false);
  };

  const handlePause = async (campaignId: string, currentStatus: string) => {
    setMutating(true);
    const newStatus = currentStatus === 'PAUSED' ? 'ACTIVE' : 'PAUSED';
    await fetch(`/api/admin/flywheel/campaigns/${campaignId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    await fetchCampaigns();
    setSelectedCampaign(prev => prev ? { ...prev, status: newStatus } : null);
    setMutating(false);
  };

  const handleDelete = async (campaignId: string) => {
    if (!confirm('Delete this campaign? This cannot be undone.')) return;
    setMutating(true);
    await fetch(`/api/admin/flywheel/campaigns/${campaignId}`, { method: 'DELETE' });
    setSelectedCampaign(null);
    await fetchCampaigns();
    setMutating(false);
  };

  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<{ processedCount: number; failedCount: number; totalFound: number } | null>(null);

  const handleProcessNow = async () => {
    setProcessing(true);
    setProcessResult(null);
    try {
      const res = await fetch('/api/admin/flywheel/cron/process-campaigns');
      const data = await res.json();
      setProcessResult({ processedCount: data.processedCount ?? 0, failedCount: data.failedCount ?? 0, totalFound: data.totalFound ?? 0 });
      fetchCampaigns();
    } catch { setProcessResult({ processedCount: 0, failedCount: 0, totalFound: 0 }); }
    finally { setProcessing(false); }
  };


  const renderCampaignActions = (c: Campaign) => (
    <>
      {c.status === 'DRAFT' && (
        <button onClick={() => handleDispatch(c.id)} disabled={dispatching}
          className="px-3 py-1.5 rounded-md text-xs font-semibold text-white transition-opacity flex items-center gap-1 disabled:opacity-60"
          style={{ background: brand.primaryColor }}>
          <IconSend size={12} /> Launch
        </button>
      )}
      {c.status === 'ACTIVE' && (
        <button onClick={() => handlePause(c.id, c.status)} disabled={mutating}
          className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-md text-xs font-semibold hover:bg-amber-100 transition-colors flex items-center gap-1">
          <IconPause size={12} /> Pause
        </button>
      )}
      {c.status === 'PAUSED' && (
        <button onClick={() => handlePause(c.id, c.status)} disabled={mutating}
          className="px-3 py-1.5 rounded-md text-xs font-semibold text-white transition-opacity flex items-center gap-1"
          style={{ background: brand.primaryColor }}>
          <IconPlay size={12} /> Resume
        </button>
      )}
      {c.status === 'SCHEDULED' && (
        <>
          <button onClick={() => handleDispatch(c.id)} disabled={dispatching}
            className="px-3 py-1.5 rounded-md text-xs font-semibold text-white transition-opacity flex items-center gap-1 disabled:opacity-60"
            style={{ background: brand.primaryColor }}
            title="Don't wait for the schedule — pick leads and send immediately">
            <IconSend size={12} /> Send now
          </button>
          <button onClick={() => cancelSchedule(c.id)} disabled={mutating}
            className="px-3 py-1.5 bg-violet-50 border border-violet-200 text-violet-700 rounded-md text-xs font-semibold hover:bg-violet-100 transition-colors flex items-center gap-1"
            title="Cancel the scheduled launch and return to draft">
            <IconX size={12} /> Cancel schedule
          </button>
        </>
      )}
      {(c.status === 'ACTIVE' || c.status === 'PAUSED') && (
        <button onClick={() => handleDispatch(c.id)} disabled={dispatching}
          className="px-3 py-1.5 rounded-md text-xs font-semibold border border-[#B8935B]/40 text-[#9A7540] bg-[#FBF8F3] hover:bg-[#F5EFE6] transition-colors flex items-center gap-1 disabled:opacity-60"
          title="Enrol newly-added leads in this campaign — anyone already in it is skipped (never re-sent)">
          <IconSend size={12} /> Add new leads
        </button>
      )}
      <button onClick={() => setSelectedCampaign(c)}
        className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-md text-xs font-medium hover:border-slate-300 transition-colors flex items-center gap-1">
        <IconEye size={12} /> Details
      </button>
      <button onClick={() => handleDelete(c.id)} disabled={mutating}
        className="px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 rounded-md text-xs font-medium hover:bg-red-100 transition-colors flex items-center gap-1">
        <IconX size={12} /> Delete
      </button>
    </>
  );

  const summaryStats = [
    { label: 'Campaigns',     value: String(campaigns.length),                                                                     color: 'text-slate-900' },
    { label: 'Active',        value: String(campaigns.filter(c => c.status === 'ACTIVE').length),                                   color: 'text-emerald-600' },
    { label: 'Emails Sent',   value: campaigns.reduce((s, c) => s + (c.stats?.sent || 0), 0).toLocaleString(),                      color: 'text-blue-600' },
    { label: 'Avg Open Rate', value: (() => { const sent = campaigns.reduce((s, c) => s + (c.stats?.sent || 0), 0); const op = campaigns.reduce((s, c) => s + (c.stats?.opens || 0), 0); return sent > 0 ? `${Math.round((op / sent) * 100)}%` : '—'; })(), color: 'text-amber-600' },
  ];

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-16">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0" style={{ background: brand.gradient }}>
              <IconMail size={20} style={{ color: '#fff' }} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Campaigns</h1>
              <p className="text-sm text-slate-500">Create, send, and track email marketing.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={handleProcessNow}
              disabled={processing}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-60"
            >
              <IconRefresh size={15} className={processing ? 'animate-spin' : ''} />
              <span className="whitespace-nowrap">{processing ? 'Processing…' : 'Process Now'}</span>
            </button>
            <button onClick={() => { setWizardOpen(true); resetWizard(); }} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-white font-medium text-sm shadow-md transition-all hover:shadow-lg" style={{ background: brand.gradient }}>
              <IconPlus size={16} /> <span className="whitespace-nowrap">New Campaign</span>
            </button>
          </div>
        </div>

        {/* Summary stats */}
        {!loading && campaigns.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {summaryStats.map(s => (
              <div key={s.label} className="relative bg-white border border-slate-200 rounded-2xl px-4 py-3.5 overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: 'var(--brand, #B8935B)', opacity: 0.5 }} />
                <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">{s.label}</p>
                <p className={`text-xl sm:text-2xl font-bold mt-1 tabular-nums ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {processResult && (
          <div className={`mb-6 px-5 py-3.5 rounded-xl border text-sm font-medium flex items-center justify-between ${
            processResult.failedCount > 0
              ? 'bg-red-50 border-red-200 text-red-700'
              : processResult.processedCount > 0
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}>
            <span>
              {processResult.totalFound === 0
                ? 'No pending emails — all campaigns are up to date.'
                : `Found ${processResult.totalFound} queued · ${processResult.processedCount} sent · ${processResult.failedCount} failed`}
            </span>
            <button onClick={() => setProcessResult(null)} className="ml-4 opacity-50 hover:opacity-100">
              <IconX size={14} />
            </button>
          </div>
        )}

        {/* Dispatch / add-leads result (shown in list; the detail modal shows its own) */}
        {dispatchResult && !selectedCampaign && (
          <div className={`mb-6 px-5 py-3.5 rounded-xl border text-sm font-medium flex items-center justify-between ${
            dispatchResult.startsWith('Error') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}>
            <span>{dispatchResult}</span>
            <button onClick={() => setDispatchResult(null)} className="ml-4 opacity-50 hover:opacity-100">
              <IconX size={14} />
            </button>
          </div>
        )}

        {/* Empty state (shared) */}
        {!loading && campaigns.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl px-6 py-16 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ background: brand.primaryLight, color: brand.primaryColor }}><IconMail size={28} /></div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No campaigns yet</h3>
            <p className="text-slate-500 text-sm mb-5 max-w-sm mx-auto">Create your first campaign — start from a ready-made template or build your own.</p>
            <button onClick={() => { setWizardOpen(true); resetWizard(); }} className="px-5 py-2.5 text-white rounded-lg text-sm font-semibold inline-flex items-center gap-1.5" style={{ background: brand.primaryColor }}>
              <IconPlus size={15} /> Create Campaign
            </button>
          </div>
        )}

        {/* ── Campaign card grid (responsive: 1 / 2 / 3 columns) ── */}
        {!(!loading && campaigns.length === 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-56 bg-slate-100 rounded-2xl animate-pulse" />)
              : campaigns.map(c => {
                  const meta = STATUS_META[c.status] || STATUS_META.DRAFT;
                  const openRate = c.stats?.openRate || 0;
                  const stepCount = c._count?.steps ?? 1;
                  return (
                    <div key={c.id} className="group bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-slate-300 transition-all flex flex-col">
                      {/* status accent bar */}
                      <div className="h-1" style={{ background: meta.color }} />

                      <div className="p-5 flex flex-col flex-1 cursor-pointer" onClick={() => setSelectedCampaign(c)}>
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <h3 className="font-bold text-slate-900 leading-snug line-clamp-2 group-hover:text-[#9A7540] transition-colors">{c.name}</h3>
                          <span className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold" style={{ background: meta.bg, color: meta.color }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />{meta.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mb-4">
                          {c.type === 'DRIP' ? 'Drip sequence' : 'One-off blast'} · {stepCount} email{stepCount === 1 ? '' : 's'} · {new Date(c.createdAt).toLocaleDateString()}
                        </p>

                        {/* stat strip */}
                        <div className="grid grid-cols-3 gap-2 mb-4">
                          {[
                            { label: 'Audience', value: c._count?.leads || 0, color: 'text-slate-800' },
                            { label: 'Sent',     value: c.stats?.sent || 0,   color: 'text-blue-600' },
                            { label: 'Opened',   value: c.stats?.opens || 0,  color: 'text-violet-600' },
                          ].map(s => (
                            <div key={s.label} className="text-center bg-slate-50 rounded-xl py-2">
                              <p className={`text-lg font-bold tabular-nums ${s.color}`}>{s.value.toLocaleString()}</p>
                              <p className="text-[10px] text-slate-400 uppercase tracking-wide">{s.label}</p>
                            </div>
                          ))}
                        </div>

                        {/* open-rate bar */}
                        <div className="mt-auto">
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="text-slate-400 font-medium">Open rate</span>
                            <span className="font-bold text-amber-600 tabular-nums">{openRate}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all" style={{ width: `${Math.min(100, openRate)}%` }} />
                          </div>
                        </div>
                      </div>

                      {/* actions */}
                      <div className="px-5 pb-4 pt-1 flex flex-wrap gap-1.5 border-t border-slate-50" onClick={e => e.stopPropagation()}>
                        {renderCampaignActions(c)}
                      </div>
                    </div>
                  );
                })}
          </div>
        )}
      </div>

      {/* ── CAMPAIGN WIZARD (Multi-step) ── */}
      <Dialog.Root open={wizardOpen} onOpenChange={setWizardOpen} modal={false}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40" />
          <Dialog.Content
            onInteractOutside={(e) => { if (galleryOpen) e.preventDefault(); }}
            onPointerDownOutside={(e) => { if (galleryOpen) e.preventDefault(); }}
            onEscapeKeyDown={(e) => { if (galleryOpen) e.preventDefault(); }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl w-[95vw] max-w-2xl z-50 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95"
          >

            {/* Wizard Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <Dialog.Title className="text-lg font-bold text-slate-900">{editingId ? 'Edit Campaign' : 'New Campaign'}</Dialog.Title>
                <Dialog.Description className="text-sm text-slate-500">Step {wizardStep} of 4</Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button className="p-2 rounded-lg hover:bg-slate-100"><IconX size={18} className="text-slate-400" /></button>
              </Dialog.Close>
            </div>

            {/* Progress Bar */}
            <div className="h-1 bg-slate-100">
              <div className="h-full transition-all duration-300" style={{ width: `${(wizardStep / 4) * 100}%`, background: brand.gradient }} />
            </div>

            {/* Wizard Body */}
            <div className="p-6 overflow-y-auto flex-1">

              {/* Step 1: Setup */}
              {wizardStep === 1 && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Campaign Name</label>
                    <input value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="e.g., Welcome Series, Summer Offer..." className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:bg-white outline-none" style={{ '--tw-ring-color': brand.primaryColor } as any} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Campaign Type</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: 'ONE_OFF', label: 'One-Off Blast', desc: 'Send once to all selected contacts' },
                        { value: 'DRIP', label: 'Drip Sequence', desc: 'Send steps over time (planned)' },
                      ].map(opt => (
                        <button key={opt.value} type="button" onClick={() => setCampaignType(opt.value)} className={`p-4 rounded-xl border-2 text-left transition-all ${campaignType === opt.value ? 'bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`} style={campaignType === opt.value ? { borderColor: brand.primaryColor } : {}}>
                          <div className="font-semibold text-slate-800 text-sm">{opt.label}</div>
                          <div className="text-xs text-slate-500 mt-1">{opt.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Audience */}
              {wizardStep === 2 && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Select Audience</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: 'ALL',        label: 'All Contacts',    desc: 'Everyone in your registry' },
                        { value: 'SUBSCRIBER', label: 'Subscribers',     desc: 'Early-stage contacts' },
                        { value: 'LEAD',       label: 'Leads',           desc: 'Active leads in pipeline' },
                        { value: 'MQL',        label: 'MQL',             desc: 'Marketing qualified leads' },
                        { value: 'SQL',        label: 'SQL',             desc: 'Sales qualified leads' },
                        { value: 'CUSTOMER',   label: 'Customers',       desc: 'Converted customers' },
                        { value: 'PICK',       label: 'Hand-pick',       desc: 'Choose specific contacts' },
                      ].map(opt => (
                        <button key={opt.value} type="button" onClick={() => { setAudienceFilter(opt.value); setLeadSearch(''); setLeadSearchResults([]); }}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${audienceFilter === opt.value ? 'bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                          style={audienceFilter === opt.value ? { borderColor: brand.primaryColor } : {}}>
                          <div className="font-semibold text-slate-800 text-sm">{opt.label}</div>
                          <div className="text-xs text-slate-500 mt-1">{opt.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hand-pick search UI */}
                  {audienceFilter === 'PICK' && (
                    <div className="space-y-3">
                      <div className="relative">
                        <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          value={leadSearch}
                          onChange={e => setLeadSearch(e.target.value)}
                          placeholder="Search by name or email…"
                          className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2"
                          style={{ '--tw-ring-color': brand.primaryColor } as any}
                        />
                      </div>
                      {leadSearching && <p className="text-xs text-slate-400">Searching…</p>}
                      {leadSearchResults.length > 0 && (
                        <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-40 overflow-y-auto">
                          {leadSearchResults.map(l => (
                            <button key={l.id} type="button" onClick={() => { setPickedLeads(p => [...p, l]); setLeadSearch(''); setLeadSearchResults([]); }}
                              className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 transition-colors">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: brand.primaryLight, color: brand.primaryColor }}>
                                {l.name[0]?.toUpperCase()}
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-slate-800">{l.name}</div>
                                <div className="text-xs text-slate-400">{l.email}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {pickedLeads.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Selected ({pickedLeads.length})</p>
                          {pickedLeads.map(l => (
                            <div key={l.id} className="flex items-center justify-between px-3 py-2 bg-[#FBF8F3] border border-[#F0EAE0] rounded-lg">
                              <div>
                                <span className="text-sm font-semibold text-slate-800">{l.name}</span>
                                <span className="text-xs text-slate-400 ml-2">{l.email}</span>
                              </div>
                              <button type="button" onClick={() => setPickedLeads(p => p.filter(x => x.id !== l.id))} className="text-slate-400 hover:text-red-500 transition-colors">
                                <IconX size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {pickedLeads.length === 0 && !leadSearch && (
                        <p className="text-xs text-slate-400 text-center py-2">Search above to add contacts</p>
                      )}
                    </div>
                  )}

                  <div className="p-4 bg-blue-50 rounded-xl flex items-center gap-3">
                    <IconUser size={18} style={{ color: brand.primaryColor }} />
                    <span className="text-sm font-semibold text-slate-700">Estimated audience: <span style={{ color: brand.primaryColor }}>{audienceCount.toLocaleString()}</span> contact{audienceCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              )}

              {/* Step 3: Content */}
              {wizardStep === 3 && (
                <div className="space-y-5">
                  {/* Email sequence bar — 1 email = one-off blast, 2+ = drip sent day by day */}
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <label className="block text-sm font-semibold text-slate-700">
                        Emails in this campaign
                        <span className="ml-2 text-xs font-normal text-slate-400">
                          {emails.length === 1 ? 'one-off blast' : `drip sequence · ${emails.length} emails over ${emails.reduce((s, e, i) => s + (i === 0 ? 0 : e.delayDays), 0)} days`}
                        </span>
                      </label>
                      <button type="button" onClick={addEmailStep}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg border border-[#B8935B]/40 text-[#9A7540] bg-[#FBF8F3] hover:bg-[#F5EFE6] transition-colors whitespace-nowrap">
                        + Add follow-up email
                      </button>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {emails.map((e, i) => (
                        <div key={e.id} className={`flex items-center gap-1 rounded-lg border text-xs font-semibold transition-all ${
                          i === activeEmailIdx ? 'border-[#B8935B] bg-[#FBF8F3] text-[#9A7540]' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}>
                          <button type="button" onClick={() => setActiveEmailIdx(i)} className="pl-3 py-1.5 pr-1">
                            Email {i + 1}
                            <span className="ml-1 font-normal text-[10px] opacity-70">
                              {i === 0 ? '· on launch' : `· +${e.delayDays}d`}
                            </span>
                          </button>
                          {emails.length > 1 && (
                            <button type="button" onClick={() => removeEmailStep(i)} title="Remove this email"
                              className="pr-2 py-1.5 text-slate-300 hover:text-red-500">×</button>
                          )}
                        </div>
                      ))}
                    </div>
                    {activeEmailIdx > 0 && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                        <span>Send</span>
                        <input type="number" min={1} max={60} value={activeEmail.delayDays}
                          onChange={e => patchActiveEmail({ delayDays: Math.min(60, Math.max(1, parseInt(e.target.value) || 1)) })}
                          className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-center font-semibold outline-none focus:ring-1" />
                        <span>day{activeEmail.delayDays === 1 ? '' : 's'} after Email {activeEmailIdx}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Email Subject Line</label>
                    <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g., We have something special for you!" className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:bg-white outline-none" style={{ '--tw-ring-color': brand.primaryColor } as any} />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-semibold text-slate-700">Email Content</label>
                      <button type="button" onClick={() => setGalleryOpen(true)}
                        className="text-xs font-bold text-white px-3 py-1.5 rounded-lg transition-colors"
                        style={{ background: brand.primaryColor }}>
                        ✨ {templateHtml ? 'Change template' : 'Start from a template'}
                      </button>
                    </div>

                    {templateHtml ? (
                      <div className="border border-[#E8DDD0] bg-[#FBF8F3] rounded-xl p-4">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold text-[#9A7540] uppercase tracking-wide">Using template</p>
                            <p className="text-sm font-bold text-slate-800 truncate">{templateName}</p>
                          </div>
                          <button type="button" onClick={clearTemplate}
                            className="flex-shrink-0 text-xs font-semibold text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                            Clear
                          </button>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          This ready-made template will be sent as-is, with each client&apos;s first name filled in automatically. See it on the Review step, or clear it to build from scratch.
                        </p>
                      </div>
                    ) : (
                    <>
                    {/* Block Editor */}
                    <div className="space-y-3 mb-4">
                      {blocks.map((block, idx) => (
                        <div key={block.id} className="flex gap-2 items-start group">
                          <div className="flex flex-col gap-0.5 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {idx > 0 && <button type="button" onClick={() => moveBlock(idx, -1)} className="text-[10px] text-slate-400 hover:text-slate-600">▲</button>}
                            {idx < blocks.length - 1 && <button type="button" onClick={() => moveBlock(idx, 1)} className="text-[10px] text-slate-400 hover:text-slate-600">▼</button>}
                          </div>
                          <div className="flex-1">
                            {block.type === 'heading' && (
                              <input value={block.content} onChange={e => updateBlock(block.id, 'content', e.target.value)} className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-sm font-bold outline-none focus:ring-1" placeholder="Hello from {brand}…" />
                            )}
                            {block.type === 'paragraph' && (
                              <textarea value={block.content} onChange={e => updateBlock(block.id, 'content', e.target.value)} rows={3} className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-sm outline-none focus:ring-1 resize-none" placeholder="Write your message here…" />
                            )}
                            {block.type === 'button' && (
                              <div className="flex gap-2">
                                <input value={block.content} onChange={e => updateBlock(block.id, 'content', e.target.value)} className="flex-1 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-sm outline-none font-semibold" placeholder="Button text" />
                                <input value={block.extra || ''} onChange={e => updateBlock(block.id, 'extra', e.target.value)} className="flex-1 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-sm outline-none" placeholder="https://..." />
                              </div>
                            )}
                            {block.type === 'divider' && (
                              <div className="border-t border-slate-300 my-2" />
                            )}
                          </div>
                          <button type="button" onClick={() => removeBlock(block.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                            <IconX size={14} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add Block Buttons */}
                    <div className="flex gap-2 flex-wrap">
                      {([['heading', 'H', '+ Heading'], ['paragraph', '¶', '+ Text'], ['button', '◉', '+ Button'], ['divider', '—', '+ Divider']] as const).map(([type, icon, label]) => (
                        <button key={type} type="button" onClick={() => addBlock(type)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5">
                          <span className="font-mono">{icon}</span> {label}
                        </button>
                      ))}
                    </div>
                    </>
                    )}
                  </div>
                </div>
              )}

              {/* Step 4: Review */}
              {wizardStep === 4 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: brand.primaryLight }}>
                      <IconSend size={24} style={{ color: brand.primaryColor }} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Ready to create?</h3>
                    <p className="text-slate-500 text-sm mt-1">Review your campaign details before creating.</p>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-5 space-y-4">
                    {[
                      ['Campaign Name', campaignName],
                      ['Type', emails.length > 1 ? `Drip Sequence · ${emails.length} emails` : 'One-Off Blast'],
                      ['Audience', audienceFilter === 'PICK' ? `Hand-picked: ${pickedLeads.map(l => l.name).join(', ')}` : audienceFilter === 'ALL' ? `All contacts (${audienceCount})` : `${audienceFilter} (${audienceCount})`],
                    ].map(([label, value]) => (
                      <div key={label as string} className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">{label}</span>
                        <span className="text-sm font-semibold text-slate-800">{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Sequence schedule */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">
                      {emails.length > 1 ? 'Sequence schedule' : 'Email'}
                    </h4>
                    <div className="space-y-1.5">
                      {(() => {
                        let day = 0;
                        return emails.map((e, i) => {
                          day += i === 0 ? 0 : e.delayDays;
                          return (
                            <button key={e.id} type="button" onClick={() => setActiveEmailIdx(i)}
                              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all ${
                                i === activeEmailIdx ? 'border-[#B8935B] bg-[#FBF8F3]' : 'border-slate-200 hover:border-slate-300'
                              }`}>
                              <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                                {i === 0 ? 'Day 0' : `Day ${day}`}
                              </span>
                              <span className="text-sm font-semibold text-slate-800 truncate flex-1">{e.subject || '(no subject)'}</span>
                              <span className="flex-shrink-0 text-[10px] text-slate-400">
                                {e.templateHtml ? e.templateName : `${e.blocks.length} blocks`}
                              </span>
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* Email Preview (click an email above to preview it) */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">
                      Preview — Email {activeEmailIdx + 1}
                    </h4>
                    <div className="border border-slate-200 rounded-xl overflow-hidden" style={{ height: 420 }}>
                      {mounted && (
                        <iframe
                          key={activeEmail.id}
                          srcDoc={buildEmailPreview(activeEmail)}
                          title="Email preview"
                          style={{ width: '100%', height: '100%', border: 'none' }}
                          sandbox="allow-same-origin"
                        />
                      )}
                    </div>
                  </div>

                  {/* When editing a running campaign: send any newly-added follow-up now */}
                  {editingId && (
                    <label className="flex items-start gap-2.5 p-3 rounded-xl border border-[#E8DDD0] bg-[#FBF8F3] cursor-pointer">
                      <input type="checkbox" checked={sendFollowupNow} onChange={e => setSendFollowupNow(e.target.checked)} className="w-4 h-4 mt-0.5 accent-[#B8935B]" />
                      <span className="text-xs text-slate-600 leading-relaxed">
                        <span className="font-semibold text-slate-800">Send newly-added follow-up now</span> — deliver it immediately to leads who already finished the sequence, instead of waiting for its delay. (Existing emails are never re-sent.)
                      </span>
                    </label>
                  )}
                </div>
              )}
            </div>

            {/* Wizard Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex justify-between">
              <button onClick={() => wizardStep > 1 ? setWizardStep(wizardStep - 1) : setWizardOpen(false)} className="px-4 py-2 text-slate-500 font-medium rounded-lg hover:bg-slate-50 text-sm transition-colors">
                {wizardStep > 1 ? '← Back' : 'Cancel'}
              </button>
              {wizardStep < 4 ? (
                <button onClick={() => setWizardStep(wizardStep + 1)}
                  disabled={
                    (wizardStep === 1 && !campaignName) ||
                    (wizardStep === 2 && audienceFilter === 'PICK' && pickedLeads.length === 0) ||
                    (wizardStep === 3 && emails.some(e => !e.subject.trim() || !emailHasContent(e)))
                  }
                  className="px-5 py-2 text-white font-medium rounded-lg text-sm disabled:opacity-50 transition-all" style={{ background: brand.primaryColor }}>
                  Next →
                </button>
              ) : (
                <button onClick={handleCreate} disabled={saving || !campaignName} className="px-5 py-2 text-white font-medium rounded-lg text-sm disabled:opacity-50 shadow-sm transition-all" style={{ background: brand.gradient }}>
                  {saving ? 'Saving…' : editingId ? 'Save Changes' : emails.length > 1 ? `Create ${emails.length}-Email Sequence` : 'Create Campaign'}
                </button>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* ── CAMPAIGN DETAIL SLIDE-OVER ── */}
      <Dialog.Root open={!!selectedCampaign} modal={false} onOpenChange={open => { if (!open) { setSelectedCampaign(null); setDispatchResult(null); } }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40" />
          <Dialog.Content
            onInteractOutside={(e) => { if (picker || testSendFor) e.preventDefault(); }}
            onPointerDownOutside={(e) => { if (picker || testSendFor) e.preventDefault(); }}
            className="fixed top-0 right-0 h-full w-[90vw] max-w-md bg-white shadow-2xl z-50 animate-in slide-in-from-right duration-300 flex flex-col"
          >
            {selectedCampaign && (
              <>
                <div className="p-6 border-b border-slate-100" style={{ background: STATUS_META[selectedCampaign.status]?.bg || '#f1f5f9' }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <Dialog.Title className="text-lg font-bold text-slate-900">{selectedCampaign.name}</Dialog.Title>
                      <Dialog.Description className="text-sm text-slate-500 mt-0.5">
                        {selectedCampaign.type.replace('_', ' ')} · Created {new Date(selectedCampaign.createdAt).toLocaleDateString()}
                      </Dialog.Description>
                    </div>
                    <Dialog.Close asChild>
                      <button className="p-2 rounded-lg hover:bg-white/50"><IconX size={18} className="text-slate-400" /></button>
                    </Dialog.Close>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold mt-3" style={{
                    background: STATUS_META[selectedCampaign.status]?.color + '20',
                    color: STATUS_META[selectedCampaign.status]?.color
                  }}>
                    {STATUS_META[selectedCampaign.status]?.label}
                  </span>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                  <div className="bg-blue-50 rounded-lg px-4 py-2.5 text-sm text-blue-700 font-medium">
                    Audience:{' '}
                    <strong>
                      {selectedCampaign.metadata?.audienceFilter === 'PICK'
                        ? `Hand-picked (${selectedCampaign.metadata.contactIds?.length ?? 0} contacts)`
                        : selectedCampaign.metadata?.audienceFilter ?? 'ALL'}
                    </strong>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-slate-800">{selectedCampaign._count?.leads || 0}</div>
                      <div className="text-xs text-slate-500 mt-1">Audience</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">{selectedCampaign.stats?.sent || 0}</div>
                      <div className="text-xs text-slate-500 mt-1">Sent</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-violet-600">{selectedCampaign.stats?.opens || 0}</div>
                      <div className="text-xs text-slate-500 mt-1">Opens</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-amber-600">{selectedCampaign.stats?.openRate || 0}%</div>
                      <div className="text-xs text-slate-500 mt-1">Open Rate</div>
                    </div>
                  </div>

                  {/* Manage */}
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.18em] mb-2">Manage</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => handleEdit(selectedCampaign)}
                        className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                        ✎ Edit content
                      </button>
                      <button onClick={() => handleDuplicate(selectedCampaign)} disabled={mutating}
                        className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50">
                        ⧉ Duplicate
                      </button>
                      <button onClick={() => { setTestSendFor(selectedCampaign); setTestStepIdx(0); }}
                        className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                        ✉ Send test
                      </button>
                      <a href={`/api/admin/flywheel/campaigns/${selectedCampaign.id}/export`}
                        className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                        ⭳ Export CSV
                      </a>
                    </div>
                    {editingId ? null : (
                      <p className="text-[10px] text-slate-400 mt-1.5">Editing a live campaign updates unsent emails only; drafts can be fully changed.</p>
                    )}
                  </div>

                  {/* Enrolled leads */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.18em]">Enrolled leads</p>
                      {enrolledFor === selectedCampaign.id && enrolled ? (
                        <button onClick={() => { setEnrolled(null); setEnrolledFor(null); }} className="text-[11px] font-semibold text-slate-400 hover:text-slate-600">Hide</button>
                      ) : (
                        <button onClick={() => fetchEnrolled(selectedCampaign.id)} className="text-[11px] font-semibold text-[#9A7540] hover:underline">View who&rsquo;s enrolled →</button>
                      )}
                    </div>
                    {enrolledFor === selectedCampaign.id && (
                      enrolledLoading ? (
                        <p className="text-xs text-slate-400 py-2">Loading…</p>
                      ) : enrolled && enrolled.length === 0 ? (
                        <p className="text-xs text-slate-400 py-2">No one is enrolled yet — dispatch the campaign to add leads.</p>
                      ) : enrolled ? (
                        <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 max-h-64 overflow-y-auto">
                          {enrolled.map(l => {
                            const paused = l.status === 'PAUSED';
                            return (
                              <div key={l.leadId} className="flex items-center gap-2 px-3 py-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold text-slate-700 truncate">{l.name}</p>
                                  <p className="text-[10px] text-slate-400 truncate">{l.email} · email {l.stepIndex + 1} · {l.status.toLowerCase()}</p>
                                </div>
                                <button onClick={() => leadAction(selectedCampaign.id, l.leadId, paused ? 'resume' : 'pause')}
                                  className="text-[10px] font-semibold px-2 py-1 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50">
                                  {paused ? 'Resume' : 'Pause'}
                                </button>
                                <button onClick={() => leadAction(selectedCampaign.id, l.leadId, 'remove')}
                                  className="text-[10px] font-semibold px-2 py-1 rounded-md border border-red-200 text-red-500 hover:bg-red-50">
                                  Remove
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : null
                    )}
                  </div>

                  {dispatchResult && (
                    <div className={`p-4 rounded-lg text-sm font-medium ${dispatchResult.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{dispatchResult}</div>
                  )}
                </div>

                <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center gap-2">
                  <button onClick={() => handleDelete(selectedCampaign.id)} disabled={mutating} className="px-4 py-2 text-red-600 font-medium hover:bg-red-50 rounded-lg text-sm border border-red-200 flex items-center gap-1.5 whitespace-nowrap mr-auto">
                    <IconX size={14} /> Delete
                  </button>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <Dialog.Close asChild>
                      <button className="px-4 py-2 text-slate-500 font-medium hover:bg-slate-100 rounded-lg text-sm">Close</button>
                    </Dialog.Close>
                    {selectedCampaign.status === 'DRAFT' && (
                      <button onClick={() => handleDispatch(selectedCampaign.id)} disabled={dispatching} className="px-5 py-2 text-white font-medium rounded-lg shadow-sm text-sm flex items-center gap-2" style={{ background: brand.primaryColor }}>
                        <IconSend size={14} /> {dispatching ? 'Dispatching...' : 'Launch Campaign'}
                      </button>
                    )}
                    {selectedCampaign.status === 'SCHEDULED' && (
                      <>
                        <button onClick={() => cancelSchedule(selectedCampaign.id)} disabled={mutating} className="px-4 py-2 bg-violet-100 text-violet-700 font-medium rounded-lg text-sm flex items-center gap-2 border border-violet-200 whitespace-nowrap">
                          <IconX size={14} /> Cancel Schedule
                        </button>
                        <button onClick={() => handleDispatch(selectedCampaign.id)} disabled={dispatching} className="px-4 py-2 text-white font-medium rounded-lg shadow-sm text-sm flex items-center gap-2 whitespace-nowrap" style={{ background: brand.primaryColor }}>
                          <IconSend size={14} /> Send Now Instead
                        </button>
                      </>
                    )}
                    {(selectedCampaign.status === 'ACTIVE' || selectedCampaign.status === 'PAUSED') && (
                      <button onClick={() => handleDispatch(selectedCampaign.id)} disabled={dispatching}
                        className="px-4 py-2 font-medium rounded-lg text-sm flex items-center gap-2 border border-[#B8935B]/40 text-[#9A7540] bg-[#FBF8F3] hover:bg-[#F5EFE6]"
                        title="Pick leads to enrol — anyone already in the campaign is skipped">
                        <IconSend size={14} /> Add / Send to Leads
                      </button>
                    )}
                    {selectedCampaign.status === 'ACTIVE' && (
                      <button onClick={() => handlePause(selectedCampaign.id, selectedCampaign.status)} disabled={mutating} className="px-5 py-2 bg-amber-500 text-white font-medium rounded-lg shadow-sm text-sm flex items-center gap-2">
                        <IconPause size={14} /> Pause Campaign
                      </button>
                    )}
                    {selectedCampaign.status === 'PAUSED' && (
                      <button onClick={() => handlePause(selectedCampaign.id, selectedCampaign.status)} disabled={mutating} className="px-5 py-2 text-white font-medium rounded-lg shadow-sm text-sm flex items-center gap-2" style={{ background: brand.primaryColor }}>
                        <IconPlay size={14} /> Resume Campaign
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* ── Send-test modal ── */}
      {testSendFor && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => !testSending && setTestSendFor(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-900 mb-1">Send a test email</h3>
            <p className="text-xs text-slate-400 mb-4">A real copy of the email is sent so you can check it in an inbox. Uses a sample first name.</p>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Send to</label>
            <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="you@example.com"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-1 mb-3" />
            <label className="block text-xs font-semibold text-slate-500 mb-1">Which email</label>
            <select value={testStepIdx} onChange={e => setTestStepIdx(Number(e.target.value))}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-1 mb-4">
              {Array.from({ length: (testSendFor?._count?.steps ?? 1) }, (_, i) => (
                <option key={i} value={i}>Email {i + 1}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setTestSendFor(null)} disabled={testSending}
                className="px-4 py-2.5 text-sm font-semibold text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50">Cancel</button>
              <button onClick={handleTestSend} disabled={testSending || !testEmail.trim()}
                className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50" style={{ background: brand.primaryColor }}>
                {testSending ? 'Sending…' : 'Send test'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Launch lead picker: select/deselect exactly who receives it ── */}
      {picker && (() => {
        const q = pickerSearch.trim().toLowerCase();
        const visible = q
          ? picker.leads.filter(l => l.name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q))
          : picker.leads;
        const allVisibleChecked = visible.length > 0 && visible.every(l => pickerChecked.has(l.id));
        const toggleAllVisible = () => setPickerChecked(prev => {
          const next = new Set(prev);
          if (allVisibleChecked) visible.forEach(l => next.delete(l.id));
          else visible.forEach(l => next.add(l.id));
          return next;
        });
        return (
          <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => !dispatching && setPicker(null)}>
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900">Send &ldquo;{picker.campaignName}&rdquo;</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {pickerChecked.size} of {picker.leads.length} selected · leads already in this campaign are skipped automatically (never re-sent)
                </p>
              </div>
              <div className="px-5 pt-3 flex items-center gap-2">
                <div className="relative flex-1">
                  <IconSearch size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} placeholder="Search name or email…"
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-1" />
                </div>
                <button type="button" onClick={toggleAllVisible}
                  className="text-xs font-semibold text-slate-600 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 whitespace-nowrap">
                  {allVisibleChecked ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
                {visible.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No leads match your search.</p>}
                {visible.map(l => {
                  const checked = pickerChecked.has(l.id);
                  return (
                    <label key={l.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                      checked ? 'border-[#B8935B]/40 bg-[#FBF8F3]' : 'border-slate-100 hover:border-slate-200'
                    }`}>
                      <input type="checkbox" checked={checked}
                        onChange={() => setPickerChecked(prev => { const n = new Set(prev); if (checked) n.delete(l.id); else n.add(l.id); return n; })}
                        className="w-4 h-4 accent-[#B8935B]" />
                      <span className="text-sm font-semibold text-slate-800 truncate">{l.name}</span>
                      <span className="text-xs text-slate-400 truncate ml-auto">{l.email}</span>
                    </label>
                  );
                })}
              </div>
              {/* When to send */}
              <div className="px-5 pt-3 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.18em] mb-2">When to send</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button type="button" onClick={() => setPickerTiming('NOW')}
                    className={`text-left p-2.5 rounded-xl border transition-all ${pickerTiming === 'NOW' ? 'border-[#B8935B] bg-[#FBF8F3]' : 'border-slate-200 hover:border-slate-300'}`}>
                    <p className="text-sm font-semibold text-slate-800">Send now</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">First email goes out immediately</p>
                  </button>
                  <button type="button" onClick={() => setPickerTiming('SCHEDULE')}
                    className={`text-left p-2.5 rounded-xl border transition-all ${pickerTiming === 'SCHEDULE' ? 'border-[#B8935B] bg-[#FBF8F3]' : 'border-slate-200 hover:border-slate-300'}`}>
                    <p className="text-sm font-semibold text-slate-800">Schedule</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Launch automatically later</p>
                  </button>
                </div>
                {pickerTiming === 'SCHEDULE' && (
                  <div className="mt-2 flex items-center gap-2">
                    <input type="datetime-local" value={pickerScheduleAt}
                      onChange={e => setPickerScheduleAt(e.target.value)}
                      min={new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)}
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-1" />
                    <span className="text-[10px] text-slate-400">your local time</span>
                  </div>
                )}
              </div>

              <div className="px-5 py-4 flex gap-2">
                <button onClick={() => setPicker(null)} disabled={dispatching}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50">
                  Cancel
                </button>
                <button onClick={confirmDispatch}
                  disabled={dispatching || pickerChecked.size === 0 || (pickerTiming === 'SCHEDULE' && !pickerScheduleAt)}
                  className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: brand.primaryColor }}>
                  {dispatching
                    ? 'Working…'
                    : pickerTiming === 'SCHEDULE'
                      ? `Schedule for ${pickerChecked.size} lead${pickerChecked.size === 1 ? '' : 's'}`
                      : `Send now to ${pickerChecked.size} lead${pickerChecked.size === 1 ? '' : 's'}`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Template Gallery ── */}
      {galleryOpen && (() => {
        const brandId = activeBrand === 'all' ? 'catalyst' : activeBrand;
        const cats: (TemplateCategory | 'ALL')[] = ['ALL', 'EXECUTIVE', 'MID_CAREER', 'CONVERT_NEW', 'WIN_BACK', 'GROW_EXISTING', 'SEASONAL'];
        const list = galleryCat === 'ALL' ? MARKETING_TEMPLATES : MARKETING_TEMPLATES.filter(t => t.category === galleryCat);
        const previewId = (galleryPreviewId && list.some(t => t.id === galleryPreviewId)) ? galleryPreviewId : list[0]?.id;
        const previewTpl = MARKETING_TEMPLATES.find(t => t.id === previewId);
        return (
          <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => setGalleryOpen(false)}>
            <div className="bg-white rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Template Gallery</h3>
                  <p className="text-xs text-slate-400">{MARKETING_TEMPLATES.length} conversion-ready templates · select one to preview, then use it</p>
                </div>
                <button onClick={() => setGalleryOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
                  <IconX size={18} />
                </button>
              </div>

              {/* Category tabs */}
              <div className="px-6 pt-3 flex gap-2 flex-wrap border-b border-slate-100 pb-3 flex-shrink-0">
                {cats.map(c => (
                  <button key={c} onClick={() => { setGalleryCat(c); setGalleryPreviewId(null); }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      galleryCat === c ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    style={galleryCat === c ? { background: brand.primaryColor } : undefined}>
                    {c === 'ALL' ? 'All' : TEMPLATE_CATEGORY_LABELS[c]}
                  </button>
                ))}
              </div>

              {/* Two-pane: list + single preview */}
              <div className="flex flex-1 min-h-0">
                {/* Left — list */}
                <div className="w-2/5 max-w-xs border-r border-slate-100 overflow-y-auto p-3 space-y-1.5">
                  {list.map(tpl => {
                    const selected = tpl.id === previewId;
                    return (
                      <button key={tpl.id} onClick={() => setGalleryPreviewId(tpl.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${
                          selected ? 'border-[#B8935B] bg-[#FBF8F3]' : 'border-transparent hover:bg-slate-50'
                        }`}>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#B8935B]">{TEMPLATE_CATEGORY_LABELS[tpl.category]}</span>
                        <p className="text-sm font-bold text-slate-900 leading-tight mt-0.5">{tpl.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{tpl.description}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Right — preview */}
                <div className="flex-1 flex flex-col min-w-0 bg-slate-100">
                  <div className="flex-1 overflow-hidden">
                    {previewId ? (
                      <iframe
                        key={previewId}
                        src={`/api/admin/marketing/templates/preview?id=${previewId}&brandId=${brandId}`}
                        title={previewTpl?.name ?? 'preview'}
                        className="w-full h-full border-0"
                        sandbox="allow-same-origin"
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center text-sm text-slate-400">No templates in this category.</div>
                    )}
                  </div>
                  {previewTpl && (
                    <div className="p-4 border-t border-slate-200 bg-white flex items-center gap-3 flex-shrink-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-800 truncate">{previewTpl.name}</p>
                        <p className="text-xs text-slate-400 truncate">Subject: {previewTpl.subject}</p>
                      </div>
                      <a href={`/api/admin/marketing/templates/preview?id=${previewTpl.id}&brandId=${brandId}`} target="_blank" rel="noopener noreferrer"
                        className="flex-shrink-0 text-xs font-semibold text-slate-600 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                        Open in new tab
                      </a>
                      <button onClick={() => applyTemplate(previewTpl)}
                        className="flex-shrink-0 text-xs font-bold text-white px-4 py-2 rounded-lg transition-colors"
                        style={{ background: brand.primaryColor }}>
                        Use this template
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </AppShell>
  );
}
