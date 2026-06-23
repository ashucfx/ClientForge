// src/emails/shared/TotalBanner.tsx
// Dark gradient total-payable banner.

import { Section, Row, Column, Text } from '@react-email/components';
import * as React from 'react';
import type { BrandToken } from '@/lib/brand/types';

interface TotalBannerProps {
  label: string;
  sublabel?: string;
  amount: string;
  brand: BrandToken;
}

export function TotalBanner({ label, sublabel, amount, brand }: TotalBannerProps) {
  return (
    <Section style={{
      margin: '16px 0',
      background: 'linear-gradient(135deg, #0A0B0D 0%, #1C1812 60%, #2A1F0E 100%)',
      borderRadius: '10px',
      padding: '0',
      overflow: 'hidden',
    }}>
      {/* Gold accent bar */}
      <div style={{ height: '2px', background: brand.accentBar }} />
      <Row style={{ padding: '20px 24px' }}>
        <Column style={{ verticalAlign: 'middle' as const }}>
          <Text style={{
            margin: 0,
            fontSize: '10px',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.50)',
            textTransform: 'uppercase' as const,
            letterSpacing: '1.5px',
          }}>
            {label}
          </Text>
          {sublabel && (
            <Text style={{
              margin: '2px 0 0',
              fontSize: '12px',
              color: 'rgba(255,255,255,0.35)',
            }}>
              {sublabel}
            </Text>
          )}
        </Column>
        <Column style={{ textAlign: 'right' as const, verticalAlign: 'middle' as const }}>
          <Text className="total-amount" style={{
            margin: 0,
            fontSize: '28px',
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: '-0.5px',
            lineHeight: '1',
          }}>
            {amount}
          </Text>
        </Column>
      </Row>
    </Section>
  );
}
