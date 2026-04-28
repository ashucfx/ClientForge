// src/emails/career/WelcomeEmail.tsx

import { Section, Text, Row, Column } from '@react-email/components';
import * as React from 'react';
import {
  EmailBase, EmailHeading, EmailBody, EmailButton, EmailSubheading,
} from './base/EmailBase';

interface WelcomeEmailProps {
  name: string;
  packageLabel: string;
  portalUrl: string;
}

export function WelcomeEmail({ name, packageLabel, portalUrl }: WelcomeEmailProps) {
  const firstName = name?.split(' ')[0] ?? 'there';
  return (
    <EmailBase
      preview={`Welcome ${firstName} — your ${packageLabel} package is now active. Let's build something exceptional.`}
      accentColor="#B8935B"
    >
      <EmailHeading>Welcome, {firstName}. Your career transformation starts now.</EmailHeading>
      <EmailBody>
        Your <strong style={{ color: '#0f172a' }}>{packageLabel}</strong> package has been
        successfully activated under <strong style={{ color: '#B8935B' }}>Catalyst</strong> by Catalyst.
        Our specialists will begin work as soon as you submit your details through the portal below.
      </EmailBody>

      {/* Package card */}
      <Section style={packageCard}>
        <Row>
          <Column style={{ width: '4px', backgroundColor: '#B8935B', borderRadius: '4px', marginRight: '16px' }} />
          <Column style={{ paddingLeft: '16px', verticalAlign: 'middle' }}>
            <Text style={pkgLabel}>Package Activated</Text>
            <Text style={pkgValue}>{packageLabel}</Text>
          </Column>
          <Column style={{ verticalAlign: 'middle', textAlign: 'right' as const }}>
            <span style={activePill}>Active</span>
          </Column>
        </Row>
      </Section>

      <EmailButton href={portalUrl}>Access Your Portal</EmailButton>

      {/* Next steps */}
      <EmailSubheading>Your journey — step by step</EmailSubheading>
      <Section style={stepsCard}>
        {[
          ['01', 'Log in to your secure portal and complete the intake form'],
          ['02', 'Our expert team reviews your submission within 2-4 hours'],
          ['03', 'Work begins within 24-48 hours of receiving your details'],
          ['04', 'Review your professionally crafted draft and share feedback'],
          ['05', 'Final, polished files delivered — ready to make an impression'],
        ].map(([num, text]) => (
          <Row key={num} style={{ marginBottom: '12px' }}>
            <Column style={{ width: '36px', verticalAlign: 'top' }}>
              <Text style={stepNum}>{num}</Text>
            </Column>
            <Column style={{ verticalAlign: 'top', paddingLeft: '8px' }}>
              <Text style={stepText}>{text}</Text>
            </Column>
          </Row>
        ))}
      </Section>

      <EmailBody style={{ fontSize: '14px' }}>
        Questions at any stage? Simply reply to this email or reach us at{' '}
        <a href="mailto:catalyst@theripplenexus.com" style={{ color: '#B8935B', textDecoration: 'none', fontWeight: 600 }}>
          catalyst@theripplenexus.com
        </a>
        . We are here to ensure your complete satisfaction.
      </EmailBody>

      <Text style={securityNote}>
        This portal link is personal and unique to your account — do not share it.
        If you did not purchase this package, please contact us immediately at catalyst@theripplenexus.com.
      </Text>
    </EmailBase>
  );
}

const packageCard: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  padding: '18px 20px',
  margin: '20px 0',
};

const pkgLabel: React.CSSProperties = {
  margin: '0 0 2px',
  fontSize: '11px',
  fontWeight: 600,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.8px',
};

const pkgValue: React.CSSProperties = {
  margin: 0,
  fontSize: '16px',
  fontWeight: 700,
  color: '#0f172a',
};

const activePill: React.CSSProperties = {
  display: 'inline-block',
  padding: '4px 12px',
  backgroundColor: '#dcfce7',
  color: '#16a34a',
  borderRadius: '20px',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.5px',
};

const stepsCard: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  padding: '20px 24px',
  margin: '8px 0 20px',
};

const stepNum: React.CSSProperties = {
  margin: '2px 0 0',
  fontSize: '11px',
  fontWeight: 700,
  color: '#B8935B',
  letterSpacing: '0.5px',
};

const stepText: React.CSSProperties = {
  margin: '2px 0 0',
  fontSize: '14px',
  color: '#475569',
  lineHeight: '1.5',
};

const securityNote: React.CSSProperties = {
  margin: '20px 0 0',
  fontSize: '12px',
  color: '#94a3b8',
  lineHeight: '1.6',
  borderLeft: '3px solid #e2e8f0',
  paddingLeft: '12px',
};
