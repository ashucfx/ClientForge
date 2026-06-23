// src/emails/shared/MetaGrid.tsx
// 2-column info card for invoice/proposal metadata.

import { Section, Row, Column, Text } from '@react-email/components';
import * as React from 'react';
import type { BrandToken } from '@/lib/brand/types';

interface MetaCell {
  label: string;
  value: string;
  highlight?: boolean;
  color?: string;
  danger?: boolean;
}

interface MetaGridProps {
  cells: MetaCell[];
  brand: BrandToken;
}

export function MetaGrid({ cells, brand }: MetaGridProps) {
  // Pair cells into rows of 2
  const pairs: [MetaCell, MetaCell | null][] = [];
  for (let i = 0; i < cells.length; i += 2) {
    pairs.push([cells[i], cells[i + 1] ?? null]);
  }

  return (
    <Section style={{ margin: '20px 0', borderRadius: '10px', border: '1px solid #EDE9DF', overflow: 'hidden' }}>
      {pairs.map(([left, right], rowIdx) => (
        <Row key={rowIdx} style={{ borderBottom: rowIdx < pairs.length - 1 ? '1px solid #EDE9DF' : 'none' }}>
          <Column
            className="meta-cell"
            style={{
              width: '50%',
              padding: '14px 16px',
              background: '#FAFAF8',
              borderRight: '1px solid #EDE9DF',
              verticalAlign: 'top' as const,
            }}
          >
            <Text style={labelStyle}>{left.label}</Text>
            <Text style={{
              ...valueStyle,
              color: left.danger ? '#ef4444' : left.highlight ? brand.primaryColor : left.color ?? '#0f172a',
              fontWeight: left.highlight ? 700 : 600,
            }}>
              {left.value}
            </Text>
          </Column>
          {right ? (
            <Column
              className="meta-cell"
              style={{
                width: '50%',
                padding: '14px 16px',
                background: '#FAFAF8',
                verticalAlign: 'top' as const,
              }}
            >
              <Text style={labelStyle}>{right.label}</Text>
              <Text style={{
                ...valueStyle,
                color: right.danger ? '#ef4444' : right.highlight ? brand.primaryColor : right.color ?? '#0f172a',
                fontWeight: right.highlight ? 700 : 600,
              }}>
                {right.value}
              </Text>
            </Column>
          ) : (
            <Column style={{ width: '50%' }} />
          )}
        </Row>
      ))}
    </Section>
  );
}

const labelStyle: React.CSSProperties = {
  margin: '0 0 4px',
  fontSize: '10px',
  fontWeight: 600,
  color: '#94a3b8',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.8px',
};

const valueStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '14px',
  color: '#0f172a',
  lineHeight: '1.3',
  wordBreak: 'break-word' as const,
};
