// src/emails/career/FinalDeliveryEmail.tsx

import { Section, Text, Row, Column, Button } from '@react-email/components';
import * as React from 'react';
import { EmailBase, EmailHeading, EmailBody, EmailButton, EmailSubheading } from './base/EmailBase';

interface FileItem { label: string; url: string; }
interface FinalDeliveryEmailProps {
  name: string; packageLabel: string; portalUrl: string; files: FileItem[];
}

export function FinalDeliveryEmail({ name, packageLabel, portalUrl, files }: FinalDeliveryEmailProps) {
  const firstName = name?.split(' ')[0] ?? 'there';
  const label = packageLabel ?? 'Career';
  const fileList = files ?? [];
  return (
    <EmailBase
      preview={`Your ${label} is complete — download your professionally crafted files from Catalyst`}
    >
      <Section style={{ backgroundColor: '#0A0B0D', background: 'linear-gradient(135deg, #0A0B0D 0%, #1C1812 60%, #2A1F0E 100%)', borderRadius: '10px', padding: '28px 24px', textAlign: 'center' as const, margin: '0 0 28px' }}>
        <Text style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 700, color: '#B8935B', textTransform: 'uppercase' as const, letterSpacing: '1.5px' }}>Final Delivery</Text>
        <Text style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 700, color: '#f8fafc', textAlign: 'center' as const }}>Your files are ready to download</Text>
        <Text style={{ margin: 0, fontSize: '13px', color: '#94a3b8', textAlign: 'center' as const }}>{label}</Text>
      </Section>

      <EmailHeading>Congratulations, {firstName} — it is done.</EmailHeading>
      <EmailBody>
        Your <strong style={{ color: '#0f172a' }}>{label}</strong> has been completed and polished
        to a professional standard. Your files are available for download below and will remain
        permanently accessible through your{' '}
        <strong style={{ color: '#B8935B' }}>Catalyst</strong> portal.
      </EmailBody>

      {fileList.length > 0 && (
        <>
          <EmailSubheading>Your Deliverables</EmailSubheading>
          <Section style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', margin: '8px 0 20px' }}>
            {fileList.map((file, i) => (
              <Row key={i} style={{ padding: '14px 20px', borderBottom: i < fileList.length - 1 ? '1px solid #f1f5f9' : 'none', backgroundColor: i % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                <Column style={{ verticalAlign: 'middle' }}>
                  <Text style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{file.label}</Text>
                </Column>
                <Column style={{ width: '100px', verticalAlign: 'middle', textAlign: 'right' as const }}>
                  <Button href={file.url} style={{ display: 'inline-block', padding: '6px 16px', backgroundColor: '#B8935B', color: '#fff', borderRadius: '6px', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}>Download</Button>
                </Column>
              </Row>
            ))}
          </Section>
        </>
      )}

      <EmailButton href={portalUrl} color="#B8935B">View in Portal</EmailButton>

      <EmailSubheading>Make the most of your new documents</EmailSubheading>
      <Section style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px 22px', margin: '8px 0' }}>
        {[
          'Save copies to Google Drive or Dropbox as a permanent backup',
          'Tailor your resume slightly for each application — small tweaks, big impact',
          'Update your LinkedIn profile with the optimised content from your deliverables',
          'Refresh your documents every 6 months to stay current and competitive',
          'Connect actively on LinkedIn — visibility to recruiters increases with engagement',
        ].map((tip, i) => (
          <Row key={i} style={{ marginBottom: '10px' }}>
            <Column style={{ width: '20px', verticalAlign: 'top' }}>
              <Text style={{ margin: '3px 0 0', fontSize: '12px', fontWeight: 700, color: '#10B981' }}>—</Text>
            </Column>
            <Column style={{ verticalAlign: 'top', paddingLeft: '6px' }}>
              <Text style={{ margin: '2px 0 0', fontSize: '14px', color: '#475569', lineHeight: '1.5' }}>{tip}</Text>
            </Column>
          </Row>
        ))}
      </Section>

      <EmailBody style={{ marginTop: '20px' }}>
        Thank you for placing your trust in Catalyst. We are genuinely proud of what
        we have created for you — we hope it opens doors you did not even know existed.
        Best of luck in your career journey.
      </EmailBody>
      <Text style={{ margin: '12px 0 0', fontSize: '12px', color: '#94a3b8', lineHeight: '1.6' }}>
        Download links remain active for 30 days. After that, access your files any time from your portal.
        For feedback or to share your success story, write to catalyst@theripplenexus.com.
      </Text>
    </EmailBase>
  );
}
