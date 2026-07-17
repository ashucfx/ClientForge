import * as React from 'react';
import { RnEmailShell, RnHeading, RnText, RnButton, RnMetric } from './RnEmailShell';

interface RnWelcomeEmailProps {
  clientName: string;
  projectName: string;
  portalUrl: string;
}

export function RnWelcomeEmail({ clientName, projectName, portalUrl }: RnWelcomeEmailProps) {
  const firstName = clientName.split(' ')[0];

  return (
    <RnEmailShell preview={`Welcome to your Ripple Nexus Client Portal for ${projectName}`} headerTitle="Client Portal Access">
      <RnHeading>Welcome to Ripple Nexus, {firstName}</RnHeading>
      
      <RnText>
        We are thrilled to begin working with you on <strong>{projectName}</strong>. Your dedicated client portal is now active.
      </RnText>
      
      <RnText>
        This portal will serve as the central hub for our collaboration. Here you can:
      </RnText>
      
      <ul style={{ color: '#CBD5E1', fontSize: '15px', lineHeight: '24px', margin: '0 0 24px', paddingLeft: '20px' }}>
        <li>Track project milestones and real-time progress</li>
        <li>Review and securely approve deliverables</li>
        <li>Access pending invoices and payment schedules</li>
        <li>Communicate directly with our team</li>
      </ul>
      
      <RnText style={{ borderLeft: '3px solid #3B82F6', paddingLeft: '16px', fontStyle: 'italic', backgroundColor: 'rgba(59, 130, 246, 0.05)', padding: '12px 16px', borderRadius: '4px' }}>
        Your portal access is secured via magic link—no password required. 
        Please bookmark the link below for easy access.
      </RnText>

      <RnButton href={portalUrl}>
        Access Client Portal
      </RnButton>
      
      <RnText style={{ fontSize: '13px', color: '#64748B', marginTop: '32px' }}>
        If the button above does not work, copy and paste this link into your browser:<br/>
        <a href={portalUrl} style={{ color: '#3B82F6', wordBreak: 'break-all' }}>{portalUrl}</a>
      </RnText>
    </RnEmailShell>
  );
}
