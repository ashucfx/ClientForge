// src/emails/career/LoginLinkEmail.tsx
// Sent when a returning client requests a new magic link (not the welcome email).

import { Text } from '@react-email/components';
import * as React from 'react';
import { EmailBase, EmailHeading, EmailBody, EmailButton } from './base/EmailBase';

interface LoginLinkEmailProps {
  name: string;
  portalUrl: string;
}

export function LoginLinkEmail({ name, portalUrl }: LoginLinkEmailProps) {
  const firstName = name?.split(' ')[0] ?? 'there';
  return (
    <EmailBase
      preview={`${firstName}, here is your secure login link for the Catalyst portal.`}
      accentColor="#B8935B"
    >
      <EmailHeading>Your secure login link</EmailHeading>

      <EmailBody>
        Hi <strong style={{ color: '#0f172a' }}>{firstName}</strong>, you requested access
        to your <strong style={{ color: '#B8935B' }}>CareerPilot</strong> portal.
        Click the button below to log in — this link is valid for <strong>30 minutes</strong> and
        can only be used once.
      </EmailBody>

      <EmailButton href={portalUrl}>Log in to your portal</EmailButton>

      <Text style={note}>
        If you did not request this link, you can safely ignore this email. Your account
        remains secure and no action is needed.
      </Text>

      <Text style={security}>
        This link is personal — do not forward it. It expires in 30 minutes
        and is invalidated once used.
      </Text>
    </EmailBase>
  );
}

const note: React.CSSProperties = {
  margin: '24px 0 0',
  fontSize: '14px',
  color: '#475569',
  lineHeight: '1.6',
};

const security: React.CSSProperties = {
  margin: '12px 0 0',
  fontSize: '12px',
  color: '#94a3b8',
  lineHeight: '1.6',
  borderLeft: '3px solid #e2e8f0',
  paddingLeft: '12px',
};
