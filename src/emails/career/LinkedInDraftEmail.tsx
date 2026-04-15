// src/emails/career/LinkedInDraftEmail.tsx
// Sent to the client when their LinkedIn profile optimisation draft is ready.

import { Section, Text, Row, Column } from '@react-email/components';
import * as React from 'react';
import {
  EmailBase, EmailHeading, EmailBody, EmailButton, InfoBox,
} from './base/EmailBase';

interface LinkedInDraftEmailProps {
  name: string;
  portalUrl: string;
  revisionsLeft?: number; // typically 2
}

export function LinkedInDraftEmail({
  name,
  portalUrl,
  revisionsLeft = 2,
}: LinkedInDraftEmailProps) {
  const firstName = name?.split(' ')[0] ?? 'there';

  return (
    <EmailBase
      preview={`Your LinkedIn profile optimisation draft is ready, ${firstName} - log in to review it`}
      accentColor="#0a66c2"
    >
      {/* Status banner */}
      <Section
        style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          padding: '12px 18px',
          margin: '0 0 24px',
        }}
      >
        <Text
          style={{
            margin: 0,
            fontSize: '13px',
            fontWeight: 700,
            color: '#1e40af',
            letterSpacing: '0.3px',
          }}
        >
          LinkedIn Optimisation Draft Ready
        </Text>
      </Section>

      <EmailHeading>Your LinkedIn draft is ready for review, {firstName}.</EmailHeading>

      <EmailBody>
        Our LinkedIn optimisation specialist has completed the first draft of your{' '}
        <strong style={{ color: '#0f172a' }}>LinkedIn profile</strong>. The optimised
        content - including your headline, about section, and experience summaries - is now
        available in your portal for review.
      </EmailBody>

      <InfoBox color="#0a66c2">
        Log in to your portal to view the draft content. You can leave feedback or
        request changes directly through the portal. You have{' '}
        <strong>{revisionsLeft} revision{revisionsLeft !== 1 ? 's' : ''} remaining</strong>{' '}
        on your package.
      </InfoBox>

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
          What is included in your draft
        </Text>
        {[
          'Optimised headline tailored to your target role and industry',
          'Rewritten about section highlighting your value proposition',
          'Experience summaries with achievement-focused language',
          'Skills and keyword recommendations for search visibility',
          'Profile picture and banner usage guidance',
        ].map((item, i) => (
          <Row key={i} style={{ marginBottom: '10px' }}>
            <Column style={{ width: '20px', verticalAlign: 'top' }}>
              <Text style={{ margin: '3px 0 0', fontSize: '12px', fontWeight: 700, color: '#0a66c2' }}>-</Text>
            </Column>
            <Column style={{ verticalAlign: 'top', paddingLeft: '6px' }}>
              <Text style={{ margin: '2px 0 0', fontSize: '14px', color: '#475569', lineHeight: '1.5' }}>
                {item}
              </Text>
            </Column>
          </Row>
        ))}
      </Section>

      <EmailButton href={portalUrl} color="#0a66c2">
        Review Your LinkedIn Draft
      </EmailButton>

      <Text
        style={{
          margin: '16px 0 0',
          fontSize: '12px',
          color: '#94a3b8',
          lineHeight: '1.6',
          borderLeft: '3px solid #bfdbfe',
          paddingLeft: '12px',
        }}
      >
        You have {revisionsLeft} revision{revisionsLeft !== 1 ? 's' : ''} included in your package. Once
        you are satisfied with the content, our team will finalise the profile and deliver
        the complete optimisation report. Questions? Reply to this email or message us in
        your portal.
      </Text>
    </EmailBase>
  );
}
