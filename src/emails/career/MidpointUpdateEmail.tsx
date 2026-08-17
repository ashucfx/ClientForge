// src/emails/career/MidpointUpdateEmail.tsx
// Sent once, lazily, when the client visits their portal at the midpoint of their SLA window.

import { Section, Text, Row, Column } from '@react-email/components';
import * as React from 'react';
import { EmailBase, EmailHeading, EmailBody, EmailButton } from './base/EmailBase';

interface MidpointUpdateEmailProps {
  name: string;
  packageLabel: string;
  portalUrl: string;
  daysRemaining?: number;
}

export function MidpointUpdateEmail({
  name,
  packageLabel,
  portalUrl,
  daysRemaining,
}: MidpointUpdateEmailProps) {
  const firstName = name?.split(' ')[0] ?? 'there';
  const label = packageLabel ?? 'Career Services';

  const milestones: { done: boolean; label: string; detail: string }[] = [
    { done: true,  label: 'Project Assigned',            detail: 'Your project was assigned to a specialist immediately after your brief was received.' },
    { done: true,  label: 'Industry Research',           detail: 'We have completed a deep-dive into your target industry, roles, and competitive landscape.' },
    { done: true,  label: 'Drafting & Optimization',     detail: 'Your content is actively being crafted and fine-tuned by our experts right now.' },
    { done: false, label: 'Internal QA & Final Polish',  detail: 'Before sending your draft, our QA team does a thorough review for quality and accuracy.' },
  ];

  return (
    <EmailBase
      preview={`We are halfway through your ${label} — here is a quick update on your project progress`}
      accentColor="#B8935B"
    >
      {/* Status badge */}
      <Section style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 18px', margin: '0 0 24px' }}>
        <Text style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#15803d', letterSpacing: '0.3px' }}>
          ✦ Your Project Is In Active Progress
        </Text>
      </Section>

      <EmailHeading>A quick update just for you, {firstName}.</EmailHeading>

      <EmailBody>
        We know waiting can feel uncertain, so we wanted to check in personally.
        Your <strong style={{ color: '#0f172a' }}>{label}</strong> project is actively in progress
        and our team is working diligently to deliver something truly exceptional.
        {daysRemaining !== undefined && daysRemaining > 0 && (
          <> Estimated delivery is <strong style={{ color: '#B8935B' }}>within {daysRemaining} working day{daysRemaining !== 1 ? 's' : ''}</strong>.</>
        )}
      </EmailBody>

      {/* Milestone tracker */}
      <Section style={{ margin: '4px 0 24px' }}>
        <Text style={{ margin: '0 0 14px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          What We&apos;ve Done So Far
        </Text>
        {milestones.map((m, i) => (
          <Row key={i} style={{ marginBottom: '12px' }}>
            <Column style={{ width: '28px', verticalAlign: 'top' }}>
              <Text style={{
                margin: '1px 0 0',
                fontSize: '14px',
                fontWeight: 700,
                color: m.done ? '#16a34a' : '#94a3b8',
              }}>
                {m.done ? '✓' : '○'}
              </Text>
            </Column>
            <Column style={{ verticalAlign: 'top' }}>
              <Text style={{
                margin: '0 0 2px',
                fontSize: '13px',
                fontWeight: 700,
                color: m.done ? '#0f172a' : '#94a3b8',
              }}>
                {m.label}
              </Text>
              <Text style={{ margin: 0, fontSize: '12px', color: m.done ? '#475569' : '#cbd5e1', lineHeight: '1.5' }}>
                {m.detail}
              </Text>
            </Column>
          </Row>
        ))}
      </Section>

      <EmailBody style={{ fontSize: '14px' }}>
        You don&apos;t need to do anything right now. We will send you a separate email the moment
        your draft is ready for your review. Keep an eye on your inbox!
      </EmailBody>

      <EmailButton href={portalUrl}>View Your Dashboard</EmailButton>

      <Text style={{ margin: '16px 0 0', fontSize: '12px', color: '#94a3b8', lineHeight: '1.6', borderLeft: '3px solid #fde68a', paddingLeft: '12px' }}>
        Questions? Simply reply to this email or message us directly through your portal.
        Our team typically responds within a few hours.
      </Text>
    </EmailBase>
  );
}
