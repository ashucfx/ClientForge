// src/emails/career/LinkedInSecurityEmail.tsx

import { Section, Text, Row, Column } from '@react-email/components';
import * as React from 'react';
import { EmailBase, EmailHeading, EmailBody, EmailSubheading } from './base/EmailBase';

interface LinkedInSecurityEmailProps { name: string; }

export function LinkedInSecurityEmail({ name }: LinkedInSecurityEmailProps) {
  const firstName = name?.split(' ')[0] ?? 'there';
  return (
    <EmailBase
      preview="Important: Secure your LinkedIn account before our team begins your profile optimisation"
      accentColor="#1f56d4"
    >
      <Section style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 18px', margin: '0 0 24px' }}>
        <Text style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#1e40af' }}>
          Action Required — Complete These Steps Before We Begin
        </Text>
      </Section>

      <EmailHeading>Let's secure your account first, {firstName}.</EmailHeading>
      <EmailBody>
        Your <strong style={{ color: '#0f172a' }}>LinkedIn Optimisation</strong> package is active
        and our team is ready to begin. Before we proceed, please complete the following security
        steps to protect your LinkedIn account throughout the optimisation process.
      </EmailBody>

      <EmailSubheading>Required security steps</EmailSubheading>
      <Section style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px 24px', margin: '8px 0 20px' }}>
        {[
          { num: '1', title: 'Enable two-factor authentication', detail: 'LinkedIn Settings › Sign in & security › Two-step verification › Turn On', urgent: true },
          { num: '2', title: 'Review your active sessions', detail: 'Settings › Sign in & security › Where you\'re signed in › End all sessions except current', urgent: false },
          { num: '3', title: 'Audit connected third-party apps', detail: 'Settings › Data privacy › Other applications › Revoke any unrecognized apps', urgent: false },
          { num: '4', title: 'Verify your recovery email address', detail: 'Ensure your account recovery email is current, accessible, and monitored', urgent: false },
        ].map(({ num, title, detail, urgent }) => (
          <Row key={num} style={{ marginBottom: '16px' }}>
            <Column style={{ width: '28px', verticalAlign: 'top', paddingTop: '2px' }}>
              <Text style={{ margin: 0, width: '22px', height: '22px', borderRadius: '50%', backgroundColor: urgent ? '#ef4444' : '#1f56d4', color: '#fff', fontSize: '11px', fontWeight: 700, textAlign: 'center', lineHeight: '22px' }}>{num}</Text>
            </Column>
            <Column style={{ verticalAlign: 'top', paddingLeft: '10px' }}>
              <Text style={{ margin: '0 0 3px', fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{title}</Text>
              <Text style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>{detail}</Text>
            </Column>
          </Row>
        ))}
      </Section>

      <Section style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '16px 18px', margin: '0 0 20px' }}>
        <Text style={{ margin: 0, fontSize: '13px', color: '#991b1b', lineHeight: '1.6' }}>
          <strong>Important:</strong> Ripple Nexus will never request your LinkedIn password directly.
          All optimisation recommendations are delivered as a structured document — you implement them yourself.
          If anyone claiming to be from Ripple Nexus asks for login credentials, do not comply and contact us immediately.
        </Text>
      </Section>

      <EmailBody>
        Once these steps are complete, no further action is needed from your end right now.
        Our team will proceed and deliver your optimisation document through your{' '}
        <strong style={{ color: '#1f56d4' }}>ClientForge Boost</strong> portal.
        We will notify you the moment it is ready.
      </EmailBody>
    </EmailBase>
  );
}
