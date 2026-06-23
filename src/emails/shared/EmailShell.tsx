// src/emails/shared/EmailShell.tsx
// Brand-aware shell for all non-career transactional emails.
// Light mode only — no dark-mode overrides.

import {
  Html, Head, Body, Container, Section, Row, Column,
  Text, Hr, Preview, Button, Font,
} from '@react-email/components';
import * as React from 'react';
import type { BrandToken } from '@/lib/brand/types';

export interface EmailShellProps {
  preview: string;
  children: React.ReactNode;
  brand: BrandToken;
  headerBadge?: { label: string; value: string; sub?: string };
}

export function EmailShell({ preview, children, brand, headerBadge }: EmailShellProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <Font
          fontFamily="Inter"
          fallbackFontFamily="Helvetica"
          webFont={{
            url: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf',
            format: 'truetype',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
        <Font
          fontFamily="Playfair Display"
          fallbackFontFamily="Georgia"
          webFont={{
            url: 'https://fonts.gstatic.com/s/playfairdisplay/v30/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtM.ttf',
            format: 'truetype',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
        <style>{`
          @media only screen and (max-width: 600px) {
            .email-container { width: 100% !important; }
            .email-pad { padding: 24px 16px !important; }
            .hdr-badge { display: none !important; }
            .meta-cell { display: block !important; width: 100% !important; box-sizing: border-box !important; border-right: none !important; border-bottom: 1px solid #EDE9DF !important; }
            .tl-arrow { display: none !important; }
            .tl-step { display: inline-block !important; width: 30% !important; }
            .total-amount { font-size: 24px !important; }
            .btn-pay { display: block !important; text-align: center !important; }
          }
        `}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body style={body(brand)}>
        <Container className="email-container" style={container}>

          {/* ── Header ──────────────────────────────── */}
          <Section style={header(brand)}>
            {/* Accent bar */}
            <div style={{ height: '3px', background: brand.accentBar }} />
            <Row style={{ padding: '20px 28px 18px' }}>
              {/* Logo */}
              <Column style={{ width: '44px', paddingRight: '12px', verticalAlign: 'middle' }}>
                <div
                  style={{ lineHeight: 0 }}
                  dangerouslySetInnerHTML={{ __html: brand.logoEmailHtml(40) }}
                />
              </Column>
              {/* Brand name */}
              <Column style={{ verticalAlign: 'middle' }}>
                <Text style={brandPrimary(brand)}>{brand.name.toUpperCase()}</Text>
                <Text style={brandSub(brand)}>{brand.tagline}</Text>
              </Column>
              {/* Optional badge */}
              {headerBadge && (
                <Column className="hdr-badge" style={{ verticalAlign: 'middle', textAlign: 'right' as const }}>
                  <table
                    cellPadding={0}
                    cellSpacing={0}
                    role="presentation"
                    style={{
                      background: 'rgba(255,255,255,0.12)',
                      borderRadius: '10px',
                      border: '1px solid rgba(255,255,255,0.20)',
                      display: 'inline-table',
                    }}
                  >
                    <tbody>
                      <tr>
                        <td style={{ padding: '8px 16px', textAlign: 'right' as const }}>
                          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase' as const, letterSpacing: '1.5px' }}>
                            {headerBadge.label}
                          </div>
                          <div style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', marginTop: '2px', letterSpacing: '0.3px' }}>
                            {headerBadge.value}
                          </div>
                          {headerBadge.sub && (
                            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>
                              {headerBadge.sub}
                            </div>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </Column>
              )}
            </Row>
          </Section>

          {/* Thin fade line */}
          <div style={{ height: '1px', background: `linear-gradient(90deg, ${brand.primaryColor} 0%, transparent 100%)` }} />

          {/* Content */}
          <Section className="email-pad" style={contentPad}>
            {children}
          </Section>

          <Hr style={divider} />

          {/* ── Footer ──────────────────────────────── */}
          <Section style={footer}>
            <Row>
              <Column style={{ textAlign: 'center' as const }}>
                <div style={{ margin: '0 auto 10px', lineHeight: 0, display: 'inline-block' }}>
                  <div dangerouslySetInnerHTML={{ __html: brand.logoEmailHtml(28) }} />
                </div>
                <Text style={footerBrand(brand)}>{brand.name.toUpperCase()}</Text>
                <Text style={footerLinks}>
                  <a href={brand.websiteUrl} style={footerLink(brand)}>{brand.websiteLabel}</a>
                  {'  ·  '}
                  <a href={`mailto:${brand.replyTo}`} style={footerLink(brand)}>{brand.replyTo}</a>
                </Text>
                <Text style={footerDisclaimer}>
                  {brand.footerLegal}
                </Text>
                <Text style={{ margin: 0, fontSize: '10px', color: '#94a3b8', textAlign: 'center' as const, letterSpacing: '0.5px' }}>
                  © {new Date().getFullYear()} {brand.name}. All rights reserved.{' '}
                  Powered by <span style={{ fontWeight: 500, color: '#64748b' }}>Ripple Nexus</span>
                </Text>
              </Column>
            </Row>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}

// ── Re-exported primitives (same as EmailBase.tsx) ───────────────────────────

export function EmailHeading({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <Text style={{ margin: '0 0 10px', fontSize: '26px', fontWeight: 700, color: '#0A0B0D', lineHeight: '1.3', letterSpacing: '-0.3px', ...style }}>{children}</Text>;
}

export function EmailSubheading({ children }: { children: React.ReactNode }) {
  return <Text style={{ margin: '24px 0 8px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>{children}</Text>;
}

export function EmailBody({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <Text style={{ margin: '0 0 16px', fontSize: '15px', color: '#475569', lineHeight: '1.7', ...style }}>{children}</Text>;
}

export function EmailButton({ href, children, brand }: { href: string; children: React.ReactNode; brand: BrandToken }) {
  return (
    <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
      <Button href={href} style={{ ...ctaBtn, backgroundColor: brand.primaryColor }}>
        {children}
      </Button>
    </Section>
  );
}

export function InfoBox({ children, brand }: { children: React.ReactNode; brand: BrandToken }) {
  return (
    <Section style={{
      borderLeft: `3px solid ${brand.primaryColor}`,
      backgroundColor: brand.primaryLight,
      borderRadius: '0 8px 8px 0',
      padding: '14px 20px',
      margin: '20px 0',
    }}>
      <Text style={{ margin: 0, fontSize: '14px', color: '#334155', lineHeight: '1.6' }}>
        {children}
      </Text>
    </Section>
  );
}

export function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 14px',
      borderRadius: '20px',
      backgroundColor: `${color}18`,
      border: `1px solid ${color}40`,
      color,
      fontSize: '11px',
      fontWeight: 700,
      letterSpacing: '0.8px',
      textTransform: 'uppercase' as const,
    }}>
      {label}
    </span>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const body = (brand: BrandToken): React.CSSProperties => ({
  backgroundColor: brand.id === 'catalyst' ? '#F0EDE6' : '#eef2f7',
  fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  margin: 0,
  padding: '32px 0',
});

const container: React.CSSProperties = {
  maxWidth: '620px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  borderRadius: '14px',
  overflow: 'hidden',
  boxShadow: '0 4px 28px rgba(10,11,13,0.12)',
};

const header = (brand: BrandToken): React.CSSProperties => ({
  background: brand.gradient,
  padding: 0,
});

const brandPrimary = (brand: BrandToken): React.CSSProperties => ({
  margin: 0,
  fontSize: '16px',
  fontWeight: 400,
  fontFamily: `"Playfair Display", Georgia, "Times New Roman", serif`,
  color: brand.id === 'catalyst' ? '#F4F1EB' : '#F4F5FA',
  lineHeight: '1.2',
  letterSpacing: '1.5px',
});

const brandSub = (brand: BrandToken): React.CSSProperties => ({
  margin: '3px 0 0',
  fontSize: '9px',
  fontWeight: 600,
  letterSpacing: '1.8px',
  textTransform: 'uppercase' as const,
  color: brand.id === 'catalyst' ? 'rgba(184,147,91,0.80)' : 'rgba(34,211,238,0.80)',
});

const contentPad: React.CSSProperties = {
  padding: '36px 32px',
};

const divider: React.CSSProperties = {
  borderColor: '#EDE9DF',
  borderWidth: '1px',
  margin: 0,
};

const footer: React.CSSProperties = {
  backgroundColor: '#F5F3EE',
  padding: '24px 32px',
};

const footerBrand = (brand: BrandToken): React.CSSProperties => ({
  margin: '0 0 2px',
  fontSize: '12px',
  fontWeight: 400,
  fontFamily: `"Playfair Display", Georgia, "Times New Roman", serif`,
  color: brand.primaryColor,
  textAlign: 'center' as const,
  letterSpacing: '2px',
});

const footerLinks: React.CSSProperties = {
  margin: '0 0 8px',
  fontSize: '12px',
  color: '#64748b',
  textAlign: 'center' as const,
};

const footerLink = (brand: BrandToken): React.CSSProperties => ({
  color: brand.primaryDark,
  textDecoration: 'none',
  fontWeight: 500,
});

const footerDisclaimer: React.CSSProperties = {
  margin: '0 0 8px',
  fontSize: '11px',
  color: '#94a3b8',
  textAlign: 'center' as const,
  lineHeight: '1.5',
};

const ctaBtn: React.CSSProperties = {
  display: 'inline-block',
  padding: '14px 36px',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 700,
  textDecoration: 'none',
  letterSpacing: '0.2px',
};
