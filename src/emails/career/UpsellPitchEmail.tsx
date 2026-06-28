// src/emails/career/UpsellPitchEmail.tsx
// Sent 7 days after final delivery

import { Section, Text, Row, Column } from '@react-email/components';
import * as React from 'react';
import {
  EmailBase, EmailHeading, EmailBody, EmailButton, EmailSubheading,
} from './base/EmailBase';

interface UpsellPitchEmailProps {
  name: string;
  portalLink: string;
  targetUpgrade: string; // 'PREMIUM_PLUS' or 'FULL_PACKAGE'
}

export function UpsellPitchEmail({ name, portalLink, targetUpgrade }: UpsellPitchEmailProps) {
  const firstName = name?.split(' ')[0] ?? 'there';
  
  const isPremiumPlus = targetUpgrade === 'PREMIUM_PLUS';

  return (
    <EmailBase
      preview={`Take the next step in your professional branding, ${firstName}`}
      accentColor="#B8935B"
    >
      <Section
        style={{
          backgroundColor: '#0A0B0D',
          background: 'linear-gradient(135deg, #0A0B0D 0%, #1C1812 60%, #2A1F0E 100%)',
          borderRadius: '10px',
          padding: '28px 24px',
          textAlign: 'center' as const,
          margin: '0 0 28px',
        }}
      >
        <Text
          style={{
            margin: '0 0 6px',
            fontSize: '13px',
            fontWeight: 700,
            color: '#B8935B',
            textTransform: 'uppercase' as const,
            letterSpacing: '1.5px',
          }}
        >
          {isPremiumPlus ? 'Executive Digital Presence' : 'CareerPilot'}
        </Text>
        <Text
          style={{
            margin: '0 0 4px',
            fontSize: '22px',
            fontWeight: 700,
            color: '#f8fafc',
            textAlign: 'center' as const,
          }}
        >
          Elevate Your Brand Identity
        </Text>
      </Section>

      <EmailHeading>Your professional foundation is set, {firstName}.</EmailHeading>

      <EmailBody>
        It has been a week since we delivered your updated profile materials. By now, you should 
        be experiencing the impact of a strong baseline professional narrative.
      </EmailBody>

      <EmailBody>
        {isPremiumPlus 
          ? 'Many leaders and executives at your stage choose to translate this momentum into a permanent Executive Digital Presence. A dedicated Professional Brand Identity Platform (Portfolio Website) dramatically accelerates recruiter trust, premium positioning, and professional visibility.'
          : 'To fully leverage your new profile, many professionals complete their branding transformation by upgrading to the CareerPilot package, ensuring absolute consistency across every touchpoint.'
        }
      </EmailBody>

      <Section
        style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '18px 22px',
          margin: '8px 0 24px',
        }}
      >
        <Text
          style={{
            margin: '0 0 14px',
            fontSize: '12px',
            fontWeight: 700,
            color: '#475569',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.8px',
          }}
        >
          Why take this step now?
        </Text>
        {[
          'Establish immediate, undeniable credibility with decision makers',
          'Position yourself as an authority, not just a candidate',
          'Control your narrative completely with a premium personal positioning system',
        ].map((item, i) => (
          <Row key={i} style={{ marginBottom: '10px' }}>
            <Column style={{ width: '20px', verticalAlign: 'top' }}>
              <Text style={{ margin: '3px 0 0', fontSize: '12px', fontWeight: 700, color: '#B8935B' }}>✓</Text>
            </Column>
            <Column style={{ verticalAlign: 'top', paddingLeft: '6px' }}>
              <Text style={{ margin: '2px 0 0', fontSize: '14px', color: '#475569', lineHeight: '1.5' }}>
                {item}
              </Text>
            </Column>
          </Row>
        ))}
      </Section>

      <EmailButton href={portalLink} color="#B8935B">
        Upgrade Now
      </EmailButton>

      <Text
        style={{
          margin: '24px 0 0',
          fontSize: '13px',
          color: '#64748b',
          lineHeight: '1.6',
          textAlign: 'center',
        }}
      >
        Clicking the button above will take you directly to your portal to complete the upgrade instantly.
      </Text>
    </EmailBase>
  );
}
