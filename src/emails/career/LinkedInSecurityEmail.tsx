// src/emails/career/LinkedInSecurityEmail.tsx

import { Section, Text, Row, Column } from '@react-email/components';
import * as React from 'react';
import { EmailBase, EmailHeading, EmailBody, EmailSubheading } from './base/EmailBase';

interface LinkedInSecurityEmailProps { name: string; }

export function LinkedInSecurityEmail({ name }: LinkedInSecurityEmailProps) {
  const firstName = name?.split(' ')[0] ?? 'there';
  return (
    <EmailBase
      preview={`Your LinkedIn profile optimisation is complete, ${firstName} - one important step remaining`}
      accentColor="#0a66c2"
    >
      {/* Banner */}
      <Section style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 18px', margin: '0 0 24px' }}>
        <Text style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#1e40af', letterSpacing: '0.3px' }}>
          Optimisation Complete - Secure Your Account Now
        </Text>
      </Section>

      <EmailHeading>Your LinkedIn profile has been optimised, {firstName}.</EmailHeading>

      <EmailBody>
        Our team has completed your <strong style={{ color: '#0f172a' }}>LinkedIn Profile Optimisation</strong>.
        To see your updated profile, open the LinkedIn app or visit{' '}
        <strong style={{ color: '#0a66c2' }}>linkedin.com</strong> and do a hard refresh —
        your profile is live and ready.
      </EmailBody>

      <EmailBody>
        Now that the work is done, the single most important thing you should do right now
        is <strong style={{ color: '#0f172a' }}>change your LinkedIn password</strong>. This is
        standard best practice after any account access is shared, and it ensures your account
        remains fully in your control going forward.
      </EmailBody>

      {/* Password change callout */}
      <Section style={{ backgroundColor: '#0a66c2', borderRadius: '10px', padding: '16px 20px', margin: '4px 0 24px' }}>
        <Text style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
          Step 1 — Change your password (do this first)
        </Text>
        <Text style={{ margin: 0, fontSize: '13px', color: '#bfdbfe', lineHeight: '1.6' }}>
          LinkedIn › Me › Settings &amp; Privacy › Sign in &amp; security › Change password
        </Text>
      </Section>

      <EmailSubheading>Additional security steps to complete</EmailSubheading>

      <Section style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px 24px', margin: '8px 0 20px' }}>
        {[
          {
            num: '2',
            title: 'Enable two-factor authentication',
            detail: 'Settings › Sign in & security › Two-step verification › Turn On',
          },
          {
            num: '3',
            title: 'Review active sessions',
            detail: 'Settings › Sign in & security › Where you\'re signed in › End all sessions except your own',
          },
          {
            num: '4',
            title: 'Remove unrecognised apps',
            detail: 'Settings › Data privacy › Other applications › Revoke any apps you did not authorise',
          },
          {
            num: '5',
            title: 'Verify your recovery email',
            detail: 'Confirm your account recovery email is current and accessible — this is your safety net',
          },
        ].map(({ num, title, detail }) => (
          <Row key={num} style={{ marginBottom: '16px' }}>
            <Column style={{ width: '28px', verticalAlign: 'top', paddingTop: '2px' }}>
              <Text style={{
                margin: 0, width: '22px', height: '22px', borderRadius: '50%',
                backgroundColor: '#B8935B', color: '#fff',
                fontSize: '11px', fontWeight: 700, textAlign: 'center', lineHeight: '22px',
              }}>{num}</Text>
            </Column>
            <Column style={{ verticalAlign: 'top', paddingLeft: '10px' }}>
              <Text style={{ margin: '0 0 3px', fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{title}</Text>
              <Text style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>{detail}</Text>
            </Column>
          </Row>
        ))}
      </Section>

      <EmailBody style={{ fontSize: '14px' }}>
        With your profile now optimised, you can expect increased visibility from recruiters
        and connections. Keeping your account secure ensures that visibility works entirely in your favour.
      </EmailBody>

      <Text style={{ margin: '16px 0 0', fontSize: '12px', color: '#94a3b8', lineHeight: '1.6', borderLeft: '3px solid #bfdbfe', paddingLeft: '12px' }}>
        These steps take less than five minutes and are entirely within your LinkedIn settings —
        no third-party tools required. If you have any questions, reply to this email or
        reach us through your portal.
      </Text>
    </EmailBase>
  );
}
