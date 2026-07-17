import * as React from 'react';
import { RnEmailShell, RnHeading, RnText, RnButton, RnMetric } from './RnEmailShell';
import { Section } from '@react-email/components';

interface RnGenericEmailProps {
  title: string;
  preview: string;
  heading: string;
  paragraphs: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  metadata?: Record<string, string>;
}

export function RnGenericEmail({ 
  title, 
  preview, 
  heading, 
  paragraphs, 
  ctaLabel, 
  ctaUrl, 
  metadata 
}: RnGenericEmailProps) {
  return (
    <RnEmailShell preview={preview} headerTitle={title}>
      <RnHeading>{heading}</RnHeading>
      
      {paragraphs.map((p, i) => (
        <RnText key={i}>{p}</RnText>
      ))}

      {metadata && Object.keys(metadata).length > 0 && (
        <Section style={{ marginTop: '24px', marginBottom: '24px' }}>
          {Object.entries(metadata).map(([label, value]) => (
            <RnMetric key={label} label={label} value={value} />
          ))}
        </Section>
      )}
      
      {ctaLabel && ctaUrl && (
        <RnButton href={ctaUrl}>
          {ctaLabel}
        </RnButton>
      )}
    </RnEmailShell>
  );
}
