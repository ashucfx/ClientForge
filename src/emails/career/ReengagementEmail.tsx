import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailBase, EmailBody, EmailButton, EmailHeading, EmailSubheading } from './base/EmailBase';

interface ReengagementEmailProps {
  name: string;
  packageLabel: string;
  portalUrl: string;
  engagementSequence: number;
  addedServices: string[];
  files: { label: string; url: string }[];
}

export function ReengagementEmail({
  name,
  packageLabel,
  portalUrl,
  engagementSequence,
  addedServices,
  files,
}: ReengagementEmailProps) {
  const firstName = name?.trim().split(/\s+/)[0] || 'there';
  const safeFiles = (files ?? []).filter(file => {
    try {
      const url = new URL(file.url);
      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
      return false;
    }
  });

  return (
    <EmailBase
      preview={`Welcome back, ${firstName}. Your Catalyst project and documents are ready when you are.`}
    >
      <Section style={heroCard}>
        <Text style={eyebrow}>Engagement {engagementSequence}</Text>
        <Text style={heroTitle}>Welcome back, {firstName}.</Text>
        <Text style={heroDescription}>Your Catalyst workspace is ready whenever you are.</Text>
      </Section>

      <EmailHeading>Your project is ready to continue.</EmailHeading>
      <EmailBody>
        Your <strong style={{ color: '#0f172a' }}>{packageLabel || 'Career Services'}</strong> work
        is organised in your Catalyst workspace. Use the secure link below to sign in, review your
        project, and continue where you left off.
      </EmailBody>

      {addedServices.length > 0 && (
        <Section style={detailsCard}>
          <Text style={sectionLabel}>This engagement includes</Text>
          {addedServices.map((service, index) => (
            <Text key={`${service}-${index}`} style={serviceLine}>• {service}</Text>
          ))}
        </Section>
      )}

      <EmailButton href={portalUrl}>Open your Catalyst workspace</EmailButton>

      {safeFiles.length > 0 ? (
        <>
          <EmailSubheading>Your available documents</EmailSubheading>
          <Section style={detailsCard}>
            {safeFiles.map((file, index) => (
              <Section key={`${file.label}-${index}`} style={fileRow}>
                <Text style={fileName}>{file.label}</Text>
                <Button href={file.url} style={downloadButton}>Open document</Button>
              </Section>
            ))}
          </Section>
        </>
      ) : (
        <Section style={detailsCard}>
          <Text style={sectionLabel}>Your documents</Text>
          <Text style={plainText}>As documents are prepared, they will appear in your secure workspace.</Text>
        </Section>
      )}

      <Text style={securityNote}>
        This is a fresh, single-use sign-in link for your account. If you were not expecting this
        message, please contact catalyst@theripplenexus.com.
      </Text>
    </EmailBase>
  );
}

const heroCard: React.CSSProperties = {
  margin: '0 0 24px',
  padding: '22px 24px',
  borderRadius: '12px',
  background: 'linear-gradient(135deg, #0A0B0D 0%, #1C1812 65%, #2A1F0E 100%)',
};
const eyebrow: React.CSSProperties = {
  margin: '0 0 8px', color: '#D4AF7A', fontSize: '10px', fontWeight: 700,
  letterSpacing: '1.4px', textTransform: 'uppercase',
};
const heroTitle: React.CSSProperties = {
  margin: '0 0 5px', color: '#fffdfa', fontSize: '22px', fontWeight: 700,
};
const heroDescription: React.CSSProperties = {
  margin: 0, color: '#cbd5e1', fontSize: '13px', lineHeight: '1.5',
};
const detailsCard: React.CSSProperties = {
  margin: '8px 0 20px', padding: '16px 18px', border: '1px solid #e8ddd0',
  borderRadius: '10px', backgroundColor: '#fbf8f3',
};
const sectionLabel: React.CSSProperties = {
  margin: '0 0 9px', color: '#9A7540', fontSize: '10px', fontWeight: 700,
  letterSpacing: '1px', textTransform: 'uppercase',
};
const serviceLine: React.CSSProperties = {
  margin: '5px 0', color: '#334155', fontSize: '13px', lineHeight: '1.5',
};
const fileRow: React.CSSProperties = {
  padding: '10px 0', borderBottom: '1px solid #eee7dc',
};
const fileName: React.CSSProperties = {
  margin: '0 0 8px', color: '#1e293b', fontSize: '13px', fontWeight: 600,
};
const downloadButton: React.CSSProperties = {
  display: 'inline-block', padding: '7px 12px', borderRadius: '7px',
  backgroundColor: '#B8935B', color: '#fff', fontSize: '12px', fontWeight: 700,
  textDecoration: 'none',
};
const plainText: React.CSSProperties = {
  margin: 0, color: '#475569', fontSize: '13px', lineHeight: '1.55',
};
const securityNote: React.CSSProperties = {
  margin: '18px 0 0', color: '#94a3b8', fontSize: '11px', lineHeight: '1.55',
};
