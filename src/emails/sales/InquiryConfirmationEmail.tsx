// src/emails/sales/InquiryConfirmationEmail.tsx

import * as React from 'react';
import { Section, Text, Hr } from '@react-email/components';
import { getBrand } from '@/lib/brand/registry';
import { PORTAL_URL } from '@/lib/config';
import {
  EmailShell, EmailHeading, EmailBody, EmailButton, InfoBox, StatusPill,
} from '../shared/EmailShell';

interface InquiryConfirmationEmailProps {
  name: string;
  email: string;
  displayId: string;
  requirementType: string;
  servicesRequested: string[];
}

const JOURNEY_STEPS = [
  {
    icon: '🔍',
    title: 'Expert Review',
    desc: 'Our team reviews your requirements within 24 hours',
  },
  {
    icon: '📋',
    title: 'Tailored Proposal',
    desc: "You'll receive a detailed scope and pricing proposal",
  },
  {
    icon: '🌐',
    title: 'Portal Activation',
    desc: 'Once approved, your client portal is activated for onboarding',
  },
];

export function InquiryConfirmationEmail({
  name,
  displayId,
  requirementType,
  servicesRequested,
}: InquiryConfirmationEmailProps) {
  const brand     = getBrand('catalyst');
  const firstName = name.split(' ')[0];
  const typeLabel = requirementType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <EmailShell
      preview={`Hello ${firstName}, your consultation request has been received. Reference: ${displayId}`}
      brand={brand}
    >
      {/* Success check */}
      <Section style={{ textAlign: 'center' as const, marginBottom: '24px' }}>
        <div style={{
          width: '56px',
          height: '56px',
          background: '#f0fdf4',
          border: '2px solid #bbf7d0',
          borderRadius: '50%',
          margin: '0 auto 16px',
          lineHeight: '56px',
          textAlign: 'center' as const,
          fontSize: '26px',
        }}>
          ✓
        </div>
        <EmailHeading style={{ textAlign: 'center' as const }}>
          Inquiry Received
        </EmailHeading>
        <Text style={{ margin: '0 0 12px', textAlign: 'center' as const, fontSize: '15px', color: '#475569' }}>
          Hello <strong>{firstName}</strong>, thank you for reaching out.
        </Text>
        <div style={{ textAlign: 'center' as const }}>
          <StatusPill label={displayId} color={brand.primaryColor} />
        </div>
      </Section>

      {/* Request summary */}
      <Section style={{
        background: brand.primaryLight,
        borderRadius: '10px',
        border: `1px solid ${brand.primaryColor}20`,
        padding: '16px 20px',
        marginBottom: '24px',
      }}>
        <Text style={{ margin: '0 0 8px', fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>
          Your Request
        </Text>
        <Text style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
          Type: <span style={{ color: brand.primaryColor }}>{typeLabel}</span>
        </Text>
        {servicesRequested.length > 0 && (
          <Text style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            Services: {servicesRequested.join(', ')}
          </Text>
        )}
      </Section>

      {/* Journey steps */}
      <EmailBody style={{ marginBottom: '16px' }}>
        Your request has been assigned reference <strong style={{ color: brand.primaryColor }}>{displayId}</strong>. Here&apos;s what happens next:
      </EmailBody>

      {JOURNEY_STEPS.map((step, idx) => (
        <table key={idx} role="presentation" cellPadding={0} cellSpacing={0} style={{ marginBottom: '14px', width: '100%' }}>
          <tbody>
            <tr>
              <td style={{ width: '44px', verticalAlign: 'top' as const }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  background: brand.primaryLight,
                  borderRadius: '50%',
                  textAlign: 'center' as const,
                  lineHeight: '36px',
                  fontSize: '18px',
                  border: `2px solid ${brand.primaryColor}20`,
                }}>
                  {step.icon}
                </div>
              </td>
              <td style={{ paddingLeft: '12px', verticalAlign: 'top' as const }}>
                <Text style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                  {step.title}
                </Text>
                <Text style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
                  {step.desc}
                </Text>
              </td>
            </tr>
          </tbody>
        </table>
      ))}

      <Hr style={{ borderColor: '#EDE9DF', margin: '24px 0' }} />

      {/* Instant checkout nudge */}
      <InfoBox brand={brand}>
        <strong>No payment is required at this stage.</strong> Need standard packages with instant checkout?{' '}
        <a href={`${PORTAL_URL}/checkout`} style={{ color: brand.primaryColor, fontWeight: 600 }}>
          Get started today →
        </a>
      </InfoBox>
    </EmailShell>
  );
}
