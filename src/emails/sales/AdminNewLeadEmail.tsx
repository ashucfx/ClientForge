// src/emails/sales/AdminNewLeadEmail.tsx
// Compact admin new-lead notification.

import * as React from 'react';
import { Section, Text, Button } from '@react-email/components';
import { getBrand } from '@/lib/brand/registry';
import { PORTAL_URL } from '@/lib/config';
import { EmailShell, StatusPill } from '../shared/EmailShell';
import { MetaGrid } from '../shared/MetaGrid';

interface AdminNewLeadEmailProps {
  id: string;
  displayId: string;
  name: string;
  email: string;
  requirementType: string;
  autoQualScore?: number | null;
  priority: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: '#ef4444',
  MEDIUM: '#f59e0b',
  LOW: '#10b981',
};

export function AdminNewLeadEmail({
  id,
  displayId,
  name,
  email,
  requirementType,
  autoQualScore,
  priority,
}: AdminNewLeadEmailProps) {
  const brand     = getBrand('catalyst');
  const typeLabel = requirementType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const adminUrl  = `${PORTAL_URL}/sales/inquiries/${id}`;
  const priorityColor = PRIORITY_COLORS[priority.toUpperCase()] ?? '#64748b';
  const scoreLabel = autoQualScore != null ? `${autoQualScore} / 100` : 'N/A';

  return (
    <EmailShell
      preview={`🔔 New Lead: ${displayId} — ${name} (${typeLabel})`}
      brand={brand}
    >
      <Section style={{ marginBottom: '20px' }}>
        <Text style={{ margin: '0 0 12px', fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
          New Sales Inquiry
        </Text>
        <div>
          <StatusPill label={displayId} color={brand.primaryColor} />
          {' '}
          <StatusPill label={priority} color={priorityColor} />
        </div>
      </Section>

      <MetaGrid
        brand={brand}
        cells={[
          { label: 'Name', value: name },
          { label: 'Email', value: email },
          { label: 'Type', value: typeLabel, highlight: true },
          { label: 'Qual Score', value: scoreLabel, highlight: autoQualScore != null && autoQualScore >= 70 },
          { label: 'Priority', value: priority, color: priorityColor },
          { label: 'Reference', value: displayId },
        ]}
      />

      <Section style={{ textAlign: 'center' as const, marginTop: '24px' }}>
        <Button
          href={adminUrl}
          style={{
            display: 'inline-block',
            padding: '13px 32px',
            background: brand.primaryColor,
            color: '#ffffff',
            textDecoration: 'none',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '14px',
          }}
        >
          Review Lead →
        </Button>
      </Section>
    </EmailShell>
  );
}
