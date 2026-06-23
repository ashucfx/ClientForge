// src/emails/shared/TimelineSteps.tsx
// "What happens next" 3-step horizontal row.

import { Section, Row, Column, Text } from '@react-email/components';
import * as React from 'react';
import type { BrandToken } from '@/lib/brand/types';

interface Step {
  icon: string;
  title: string;
  desc: string;
}

interface TimelineStepsProps {
  steps: Step[];
  brand: BrandToken;
}

const DEFAULT_STEPS: Step[] = [
  { icon: '📋', title: 'Expert Review', desc: 'Our specialist reviews your profile within 24 hrs' },
  { icon: '✍️', title: 'Craft & Refine', desc: 'ATS-optimised draft delivered to your portal' },
  { icon: '🚀', title: 'Launch Ready', desc: 'Unlimited revisions until you are 100% happy' },
];

export function TimelineSteps({ steps = DEFAULT_STEPS, brand }: TimelineStepsProps) {
  return (
    <Section style={{ margin: '28px 0' }}>
      <Text style={{
        margin: '0 0 16px',
        fontSize: '10px',
        fontWeight: 700,
        color: '#94a3b8',
        textTransform: 'uppercase' as const,
        letterSpacing: '1px',
        textAlign: 'center' as const,
      }}>
        What Happens Next
      </Text>
      <Row>
        {steps.map((step, idx) => (
          <React.Fragment key={idx}>
            <Column className="tl-step" style={{ textAlign: 'center' as const, verticalAlign: 'top' as const, padding: '0 8px' }}>
              {/* Icon circle */}
              <div style={{
                width: '48px',
                height: '48px',
                background: brand.primaryLight,
                borderRadius: '50%',
                textAlign: 'center' as const,
                lineHeight: '48px',
                fontSize: '22px',
                margin: '0 auto 10px',
                border: `2px solid ${brand.primaryColor}20`,
              }}>
                {step.icon}
              </div>
              {/* Step number pill */}
              <div style={{
                display: 'inline-block',
                marginBottom: '6px',
                padding: '2px 10px',
                background: brand.primaryColor,
                borderRadius: '20px',
                fontSize: '9px',
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: '1px',
                textTransform: 'uppercase' as const,
              }}>
                Step {idx + 1}
              </div>
              <Text style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                {step.title}
              </Text>
              <Text style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>
                {step.desc}
              </Text>
            </Column>
            {/* Arrow between steps */}
            {idx < steps.length - 1 && (
              <Column
                className="tl-arrow"
                style={{
                  width: '20px',
                  textAlign: 'center' as const,
                  verticalAlign: 'middle' as const,
                  paddingTop: '14px',
                  color: brand.primaryColor,
                  fontSize: '16px',
                }}
              >
                →
              </Column>
            )}
          </React.Fragment>
        ))}
      </Row>
    </Section>
  );
}
