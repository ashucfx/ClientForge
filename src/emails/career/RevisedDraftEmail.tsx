// src/emails/career/RevisedDraftEmail.tsx
// Sent to the client when an updated draft is uploaded after a revision.

import { Section, Text, Row, Column } from '@react-email/components';
import * as React from 'react';
import {
  EmailBase, EmailHeading, EmailBody, EmailButton, InfoBox,
} from './base/EmailBase';

interface RevisedDraftEmailProps {
  name: string;
  packageLabel: string;
  portalUrl: string;
  revisionsLeft?: number;
}

export function RevisedDraftEmail({
  name,
  packageLabel,
  portalUrl,
  revisionsLeft = 1,
}: RevisedDraftEmailProps) {
  const firstName = name?.split(' ')[0] ?? 'there';
  const label = packageLabel ?? 'Career';

  return (
    <EmailBase
      preview={`Your ${label} has been revised based on your request, ${firstName} - updated draft ready to review`}
      accentColor="#7c3aed"
    >
      {/* Status banner */}
      <Section
        style={{
          backgroundColor: '#f5f3ff',
          border: '1px solid #ddd6fe',
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
            color: '#5b21b6',
            letterSpacing: '0.3px',
          }}
        >
          Revision Complete - Updated Draft Ready
        </Text>
      </Section>

      <EmailHeading>Your revised {label} is ready, {firstName}.</EmailHeading>

      <EmailBody>
        We have carefully reviewed the revision you requested and incorporated every piece
        of your feedback. Your updated{' '}
        <strong style={{ color: '#0f172a' }}>{label}</strong> is now available in your
        portal - please log in, compare it against your original feedback, and let us know
        if anything still needs adjusting.
      </EmailBody>

      <InfoBox color="#7c3aed">
        {revisionsLeft > 0 ? (
          <>
            You have <strong>{revisionsLeft} revision{revisionsLeft !== 1 ? 's' : ''} remaining</strong>{' '}
            on your package. If you are satisfied with this version, no further action is needed -
            our team will proceed to final delivery.
          </>
        ) : (
          <>
            This is your final revision. If you are satisfied with this version, our team will
            proceed to final delivery. For any additional changes, please contact us directly.
          </>
        )}
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
        {[
          'All requested changes have been applied to this version',
          'Compare it carefully against your original feedback',
          'Leave a note in your portal if further tweaks are needed',
          'Approve the draft to move to final delivery',
        ].map((item, i) => (
          <Row key={i} style={{ marginBottom: '10px' }}>
            <Column style={{ width: '20px', verticalAlign: 'top' }}>
              <Text style={{ margin: '3px 0 0', fontSize: '12px', fontWeight: 700, color: '#7c3aed' }}>-</Text>
            </Column>
            <Column style={{ verticalAlign: 'top', paddingLeft: '6px' }}>
              <Text style={{ margin: '2px 0 0', fontSize: '14px', color: '#475569', lineHeight: '1.5' }}>
                {item}
              </Text>
            </Column>
          </Row>
        ))}
      </Section>

      <EmailButton href={portalUrl} color="#7c3aed">
        Review Updated Draft
      </EmailButton>

      <Text
        style={{
          margin: '16px 0 0',
          fontSize: '12px',
          color: '#94a3b8',
          lineHeight: '1.6',
          borderLeft: '3px solid #ddd6fe',
          paddingLeft: '12px',
        }}
      >
        Questions about the changes? Reply to this email or send us a message directly
        through your portal. We are committed to delivering work you are proud of.
      </Text>
    </EmailBase>
  );
}
