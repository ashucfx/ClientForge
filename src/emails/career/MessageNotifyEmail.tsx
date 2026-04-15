// src/emails/career/MessageNotifyEmail.tsx
import * as React from 'react';
import { Section, Text } from '@react-email/components';
import {
  EmailBase, EmailHeading, EmailBody, EmailButton, InfoBox,
} from './base/EmailBase';

interface Props {
  recipientName: string;
  senderType: 'client' | 'admin';
  portalUrl: string;
  body?: string;  // optional — overrides the default message body text
}

export function MessageNotifyEmail({ recipientName, senderType, portalUrl, body }: Props) {
  const fromLabel = senderType === 'admin' ? 'Your career consultant' : 'Your client';
  const defaultBody = `${fromLabel} has sent you a new message regarding your Career Booster project. Please log in to your portal to read and reply.`;
  const preview = body ? body.slice(0, 90) : `${fromLabel} has sent you a new message`;

  return (
    <EmailBase preview={preview} accentColor="#1f56d4">
      <EmailHeading>New message received</EmailHeading>
      <EmailBody>Hi {recipientName},</EmailBody>
      <EmailBody>{body ?? defaultBody}</EmailBody>

      <InfoBox color="#1f56d4">
        Messages are available in the <strong>Messages</strong> section of your portal.
        We aim to respond within 1 business day.
      </InfoBox>

      <EmailButton href={portalUrl} color="#1f56d4">
        View Message
      </EmailButton>

      <Section style={{ marginTop: '16px' }}>
        <Text style={{ margin: 0, fontSize: '13px', color: '#94a3b8', textAlign: 'center' as const }}>
          Questions? Reply to this email or contact us at{' '}
          <a href="mailto:info@theripplenexus.com" style={{ color: '#1f56d4' }}>
            info@theripplenexus.com
          </a>
        </Text>
      </Section>
    </EmailBase>
  );
}
