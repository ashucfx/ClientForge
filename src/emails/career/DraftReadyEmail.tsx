// src/emails/career/DraftReadyEmail.tsx

import { Section, Text, Row, Column } from '@react-email/components';
import * as React from 'react';
import { EmailBase, EmailHeading, EmailBody, EmailButton, EmailSubheading } from './base/EmailBase';

interface DraftReadyEmailProps {
  name: string;
  packageLabel: string;
  portalUrl: string;
}

export function DraftReadyEmail({ name, packageLabel, portalUrl }: DraftReadyEmailProps) {
  const firstName = name?.split(' ')[0] ?? 'there';
  const label = packageLabel ?? 'Career';
  return (
    <EmailBase
      preview={`Your ${label} draft is ready - log in to your ClientForge Boost portal and review it now`}
      accentColor="#1f56d4"
    >
      <Section style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 18px', margin: '0 0 24px' }}>
        <Text style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#1e40af', letterSpacing: '0.3px' }}>
          Your Draft Is Ready — Action Required
        </Text>
      </Section>

      <EmailHeading>Your {label} draft is ready for your eyes, {firstName}.</EmailHeading>
      <EmailBody>
        Excellent news — your <strong style={{ color: '#0f172a' }}>{label}</strong> has been
        carefully crafted by our team and is now awaiting your review in your{' '}
        <strong style={{ color: '#1f56d4' }}>ClientForge Boost</strong> portal.
        Please log in, review it thoroughly, and share your feedback so we can perfect it.
      </EmailBody>

      <EmailButton href={portalUrl}>Review Your Draft Now</EmailButton>

      <EmailSubheading>What to review carefully</EmailSubheading>
      <Section style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px 22px', margin: '8px 0 20px' }}>
        {[
          'Accuracy of all experience details, achievements, and employment dates',
          'Job titles and company names are spelled correctly',
          'Skills, tools, and keywords align with your target roles',
          'Tone, formatting, and overall presentation match your goals',
          'Nothing important is missing — include any feedback for additions',
        ].map((item, i) => (
          <Row key={i} style={{ marginBottom: '10px' }}>
            <Column style={{ width: '20px', verticalAlign: 'top' }}>
              <Text style={{ margin: '3px 0 0', fontSize: '12px', fontWeight: 700, color: '#1f56d4' }}>-</Text>
            </Column>
            <Column style={{ verticalAlign: 'top', paddingLeft: '6px' }}>
              <Text style={{ margin: '2px 0 0', fontSize: '14px', color: '#475569', lineHeight: '1.5' }}>{item}</Text>
            </Column>
          </Row>
        ))}
      </Section>

      <EmailBody style={{ fontSize: '14px', marginTop: '4px' }}>
        Your package includes <strong style={{ color: '#0f172a' }}>2 revision rounds</strong>.
        Use the feedback form in your portal to request any changes - our team will turnaround revisions within 24-48 hours.
      </EmailBody>

      <Text style={{ margin: '16px 0 0', fontSize: '12px', color: '#94a3b8', lineHeight: '1.6', borderLeft: '3px solid #bfdbfe', paddingLeft: '12px' }}>
        Once satisfied, approve the draft in your portal to proceed to final delivery.
        Need help? Reply to this email or reach us at info@theripplenexus.com.
      </Text>
    </EmailBase>
  );
}
