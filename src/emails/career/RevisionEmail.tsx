// src/emails/career/RevisionEmail.tsx
// Sent to the client when their revision request is approved (in progress) or denied.

import { Section, Text, Row, Column } from '@react-email/components';
import * as React from 'react';
import { EmailBase, EmailHeading, EmailBody, EmailButton, InfoBox } from './base/EmailBase';

interface RevisionEmailProps {
  name: string;
  packageLabel: string;
  portalUrl: string;
  status: 'approved' | 'denied';
}

export function RevisionEmail({ name, packageLabel, portalUrl, status }: RevisionEmailProps) {
  const firstName = name?.split(' ')[0] ?? 'there';
  const label = packageLabel ?? 'Career';
  const isApproved = status === 'approved';

  return (
    <EmailBase
      preview={
        isApproved
          ? `Your ${label} revision is now in progress — we're working on it`
          : `Update on your ${label} revision request`
      }
      accentColor={isApproved ? '#f59e0b' : '#64748b'}
    >
      {/* Status banner */}
      <Section
        style={{
          backgroundColor: isApproved ? '#fffbeb' : '#f8fafc',
          border: `1px solid ${isApproved ? '#fcd34d' : '#e2e8f0'}`,
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
            color: isApproved ? '#92400e' : '#475569',
            letterSpacing: '0.3px',
          }}
        >
          {isApproved ? 'Revision In Progress' : 'Revision Request Reviewed'}
        </Text>
      </Section>

      <EmailHeading>
        {isApproved
          ? `We're working on your revision, ${firstName}.`
          : `An update on your revision request, ${firstName}.`}
      </EmailHeading>

      <EmailBody>
        {isApproved ? (
          <>
            We have received and reviewed your revision request for your{' '}
            <strong style={{ color: '#0f172a' }}>{label}</strong>. Our team has started
            working on the changes and will have an updated draft ready for you shortly.
          </>
        ) : (
          <>
            Thank you for submitting your revision request for your{' '}
            <strong style={{ color: '#0f172a' }}>{label}</strong>. Our team has reviewed
            it and will follow up with you through the portal shortly.
          </>
        )}
      </EmailBody>

      {isApproved && (
        <>
          <InfoBox color="#f59e0b">
            Your revised document will be uploaded to your portal once complete. You will
            receive another notification when the updated draft is ready for review.
          </InfoBox>

          <Section
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '18px 22px',
              margin: '8px 0 20px',
            }}
          >
            {[
              'Our team is reviewing your requested changes carefully',
              'Revisions are typically completed within 24-48 hours',
              'You will be notified by email when the updated draft is ready',
              'Log in to your portal to track progress and communicate with our team',
            ].map((item, i) => (
              <Row key={i} style={{ marginBottom: '10px' }}>
                <Column style={{ width: '20px', verticalAlign: 'top' }}>
                  <Text style={{ margin: '3px 0 0', fontSize: '12px', fontWeight: 700, color: '#f59e0b' }}>-</Text>
                </Column>
                <Column style={{ verticalAlign: 'top', paddingLeft: '6px' }}>
                  <Text style={{ margin: '2px 0 0', fontSize: '14px', color: '#475569', lineHeight: '1.5' }}>{item}</Text>
                </Column>
              </Row>
            ))}
          </Section>
        </>
      )}

      <EmailButton href={portalUrl} color={isApproved ? '#f59e0b' : '#B8935B'}>
        {isApproved ? 'Track Progress in Your Portal' : 'View Your Portal'}
      </EmailButton>

      <Text
        style={{
          margin: '16px 0 0',
          fontSize: '12px',
          color: '#94a3b8',
          lineHeight: '1.6',
          borderLeft: `3px solid ${isApproved ? '#fcd34d' : '#e2e8f0'}`,
          paddingLeft: '12px',
        }}
      >
        Questions about your revision? Reply to this email or message us directly in your portal.
      </Text>
    </EmailBase>
  );
}
