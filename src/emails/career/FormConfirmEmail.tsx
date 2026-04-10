// src/emails/career/FormConfirmEmail.tsx

import { Section, Text, Row, Column } from '@react-email/components';
import * as React from 'react';
import { EmailBase, EmailHeading, EmailBody, EmailSubheading } from './base/EmailBase';

interface FormConfirmEmailProps { name: string; formLabel: string; }

export function FormConfirmEmail({ name, formLabel }: FormConfirmEmailProps) {
  const firstName = name?.split(' ')[0] ?? 'there';
  const label = formLabel ?? 'form';
  return (
    <EmailBase
      preview={`Details received, ${firstName} — our team will begin work on your ${label} shortly`}
      accentColor="#3FBD8B"
    >
      <Section style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#dcfce7', margin: '0 0 20px', textAlign: 'center' as const }}>
        <Text style={{ margin: 0, fontSize: '24px', color: '#16a34a', lineHeight: '52px', fontWeight: 700, textAlign: 'center' as const }}>✓</Text>
      </Section>

      <EmailHeading>We have received your details, {firstName}.</EmailHeading>
      <EmailBody>
        Your <strong style={{ color: '#0f172a' }}>{label}</strong> submission has been successfully
        received by our team. We will review it carefully and get to work — you are in expert hands.
      </EmailBody>

      <EmailSubheading>What happens next</EmailSubheading>
      <Section style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px 24px', margin: '8px 0 20px' }}>
        {[
          ['Team reviews your submission', 'Within 2–4 hours'],
          ['Work begins on your documents', 'Within 24–48 hours'],
          ['Draft sent for your review', '3–5 business days'],
          ['Revisions incorporated (if any)', '24–48 hours per round'],
          ['Final delivery to your portal', 'After your approval'],
        ].map(([milestone, time], i) => (
          <Row key={i} style={{ marginBottom: '12px' }}>
            <Column style={{ width: '8px', verticalAlign: 'top', paddingTop: '6px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3FBD8B' }} />
            </Column>
            <Column style={{ verticalAlign: 'top', paddingLeft: '12px' }}>
              <Text style={{ margin: '0 0 1px', fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{milestone}</Text>
              <Text style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{time}</Text>
            </Column>
          </Row>
        ))}
      </Section>

      <EmailBody>
        We will email you the moment your draft is ready. Track your progress any time by
        logging into your <strong style={{ color: '#1f56d4' }}>ClientForge Boost</strong> portal.
      </EmailBody>

      <Text style={{ margin: '16px 0 0', fontSize: '12px', color: '#94a3b8', lineHeight: '1.6', fontStyle: 'italic' }}>
        Need to update something? Simply re-submit the form in your portal — we will use the latest version.
        For anything else, reply to this email or write to info@theripplenexus.com.
      </Text>
    </EmailBase>
  );
}
