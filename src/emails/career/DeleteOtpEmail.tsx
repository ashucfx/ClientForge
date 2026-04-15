// src/emails/career/DeleteOtpEmail.tsx
import * as React from 'react';
import { Section, Text } from '@react-email/components';
import {
  EmailBase, EmailHeading, EmailBody, InfoBox,
} from './base/EmailBase';

interface Props {
  clientName: string;
  clientEmail: string;
  otp: string;
  expiresMinutes: number;
}

export function DeleteOtpEmail({ clientName, clientEmail, otp, expiresMinutes }: Props) {
  return (
    <EmailBase
      preview={`Admin action required — OTP to delete ${clientName}'s account: ${otp}`}
      accentColor="#ef4444"
      subBrand="Admin Panel"
    >
      <EmailHeading>Confirm Account Deletion</EmailHeading>

      <EmailBody>
        You requested to permanently delete the following Career Booster client account.
        Use the OTP below to confirm this irreversible action.
      </EmailBody>

      <Section
        style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '16px 22px',
          margin: '0 0 24px',
        }}
      >
        <Text style={{ margin: '0 0 4px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.8px' }}>
          Client Name
        </Text>
        <Text style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
          {clientName}
        </Text>
        <Text style={{ margin: '0 0 4px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.8px' }}>
          Client Email
        </Text>
        <Text style={{ margin: 0, fontSize: '14px', color: '#475569' }}>
          {clientEmail}
        </Text>
      </Section>

      <InfoBox color="#ef4444">
        <strong>This action is irreversible.</strong> All forms, deliverables, messages, email
        logs, and account data for this client will be permanently deleted.
      </InfoBox>

      <Section
        style={{
          backgroundColor: '#0f172a',
          borderRadius: '10px',
          padding: '24px',
          textAlign: 'center' as const,
          margin: '28px 0',
        }}
      >
        <Text style={{ margin: '0 0 8px', fontSize: '12px', color: '#94a3b8', letterSpacing: '2px', textTransform: 'uppercase' as const }}>
          Admin One-Time Passcode
        </Text>
        <Text style={{ margin: 0, fontSize: '42px', fontWeight: 700, color: '#f8fafc', letterSpacing: '14px' }}>
          {otp}
        </Text>
        <Text style={{ margin: '10px 0 0', fontSize: '12px', color: '#64748b' }}>
          Expires in {expiresMinutes} minutes
        </Text>
      </Section>

      <EmailBody>
        If you did not initiate this deletion, please secure your admin account immediately and
        contact{' '}
        <a href="mailto:info@theripplenexus.com" style={{ color: '#1f56d4' }}>
          info@theripplenexus.com
        </a>
      </EmailBody>
    </EmailBase>
  );
}
