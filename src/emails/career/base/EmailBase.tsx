// src/emails/career/base/EmailBase.tsx
// Catalyst branded email base
// Palette: Obsidian #0A0B0D · Signal Gold #B8935B · Bone #F4F1EB

import {
  Html, Head, Body, Container, Section, Row, Column,
  Text, Hr, Preview
} from '@react-email/components';
import * as React from 'react';
import { BRAND_EMAIL, BRAND_WEBSITE_LABEL, BRAND_WEBSITE_URL } from '@/lib/config';

interface EmailBaseProps {
  preview: string;
  children: React.ReactNode;
  accentColor?: string;
  subBrand?: string;
}

export function EmailBase({
  preview,
  children,
  accentColor = '#B8935B',
  subBrand = 'Catalyst',
}: EmailBaseProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <style>{`
          @media only screen and (max-width: 600px) {
            .email-container { width: 100% !important; }
            .email-pad { padding: 28px 20px !important; }
          }
        `}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>

          {/* ── Header ─────────────────────────────────── */}
          <Section style={header}>
            {/* Gold accent bar */}
            <div style={{ height: '3px', background: 'linear-gradient(90deg, #B8935B 0%, #D4AF7A 60%, #B8935B 100%)' }} />
            <Row style={{ padding: '20px 28px 18px' }}>
              {/* Catalyst Logo */}
              <Column style={{ width: '40px', paddingRight: '14px', verticalAlign: 'middle' }}>
                <EmailLogoMark size={36} />
              </Column>
              {/* Brand name */}
              <Column style={{ verticalAlign: 'middle' }}>
                <Text style={brandPrimary}>CATALYST</Text>
                <Text style={brandSub}>{subBrand}</Text>
              </Column>
              {/* Right tag */}
              <Column style={{ verticalAlign: 'middle', textAlign: 'right' as const }}>
                <span style={{
                  display: 'inline-block',
                  padding: '3px 10px',
                  background: 'rgba(184,147,91,0.18)',
                  border: '1px solid rgba(184,147,91,0.40)',
                  borderRadius: '20px',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: '#D4AF7A',
                  letterSpacing: '0.5px',
                }}>
                  Catalyst
                </span>
              </Column>
            </Row>
          </Section>

          {/* Thin gold fade line */}
          <div style={{ height: '1px', background: `linear-gradient(90deg, ${accentColor} 0%, transparent 100%)` }} />

          {/* Content */}
          <Section className="email-pad" style={contentPad}>
            {children}
          </Section>

          <Hr style={divider} />

          {/* ── Footer ─────────────────────────────────── */}
          <Section style={footer}>
            <Row>
              <Column style={{ textAlign: 'center' as const }}>
                <div style={{ margin: '0 auto 10px', width: '30px' }}>
                  <EmailLogoMark size={30} />
                </div>
                <Text style={footerBrand}>CATALYST</Text>
                <Text style={footerLinks}>
                  <a href={BRAND_WEBSITE_URL} style={footerLink}>{BRAND_WEBSITE_LABEL}</a>
                  {'  ·  '}
                  <a href={`mailto:${BRAND_EMAIL}`} style={footerLink}>{BRAND_EMAIL}</a>
                </Text>
                <Text style={{ ...footerDisclaimer, marginBottom: '12px' }}>
                  © {new Date().getFullYear()} Catalyst. All rights reserved.{' '}
                  This email was sent because a Catalyst package is active for this address.
                </Text>
                <Text style={{ margin: 0, fontSize: '10px', color: '#94a3b8', textAlign: 'center', letterSpacing: '0.5px' }}>
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

// ── Shared primitives ─────────────────────────────────────────────────────────

function EmailLogoMark({ size }: { size: number }) {
  const fontSize = Math.round(size * 0.62);
  const dotSize = Math.max(4, Math.round(size * 0.13));
  const dotOffset = Math.max(5, Math.round(size * 0.16));

  return (
    <table
      cellPadding={0}
      cellSpacing={0}
      role="presentation"
      width={size}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        background: '#0A0B0D',
        borderRadius: '8px',
        border: '1px solid rgba(184,147,91,0.35)',
      }}
    >
      <tbody>
        <tr>
          <td
            align="center"
            valign="middle"
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: `${fontSize}px`,
              lineHeight: `${size}px`,
              fontWeight: 700,
              color: '#F4F1EB',
              letterSpacing: 0,
            }}
          >
            C
            <span
              style={{
                display: 'inline-block',
                width: `${dotSize}px`,
                height: `${dotSize}px`,
                background: '#B8935B',
                borderRadius: '50%',
                fontSize: 0,
                lineHeight: 0,
                marginLeft: `-${dotOffset}px`,
                verticalAlign: 'middle',
              }}
            >
              &nbsp;
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function EmailHeading({ children }: { children: React.ReactNode }) {
  return <Text style={headingStyle}>{children}</Text>;
}

export function EmailSubheading({ children }: { children: React.ReactNode }) {
  return <Text style={subheadingStyle}>{children}</Text>;
}

export function EmailBody({
  children,
  style = {},
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return <Text style={{ ...bodyStyle, ...style }}>{children}</Text>;
}

export function EmailButton({
  href,
  children,
  color = '#B8935B',
}: {
  href: string;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
      <a
        href={href}
        style={{ ...ctaBtn, backgroundColor: color }}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    </Section>
  );
}

export function InfoBox({
  children,
  color = '#B8935B',
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <Section
      style={{
        borderLeft: `3px solid ${color}`,
        backgroundColor: `${color}14`,
        borderRadius: '0 8px 8px 0',
        padding: '14px 20px',
        margin: '20px 0',
      }}
    >
      <Text style={{ margin: 0, fontSize: '14px', color: '#334155', lineHeight: '1.6' }}>
        {children}
      </Text>
    </Section>
  );
}

export function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
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
      }}
    >
      {label}
    </span>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const body: React.CSSProperties = {
  backgroundColor: '#F0EDE6',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  margin: 0,
  padding: '32px 0',
};

const container: React.CSSProperties = {
  maxWidth: '600px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  borderRadius: '14px',
  overflow: 'hidden',
  boxShadow: '0 4px 28px rgba(10,11,13,0.14)',
};

const header: React.CSSProperties = {
  background: 'linear-gradient(135deg, #0A0B0D 0%, #1C1812 60%, #2A1F0E 100%)',
  padding: 0,
};

const brandPrimary: React.CSSProperties = {
  margin: 0,
  fontSize: '16px',
  fontWeight: 400,
  fontFamily: 'Georgia, "Times New Roman", serif',
  color: '#F4F1EB',
  lineHeight: '1.2',
  letterSpacing: '1.5px',
};

const brandSub: React.CSSProperties = {
  margin: '3px 0 0',
  fontSize: '9px',
  fontWeight: 600,
  letterSpacing: '1.8px',
  textTransform: 'uppercase' as const,
  color: 'rgba(184,147,91,0.80)',
};

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

const footerBrand: React.CSSProperties = {
  margin: '0 0 2px',
  fontSize: '12px',
  fontWeight: 400,
  fontFamily: 'Georgia, "Times New Roman", serif',
  color: '#B8935B',
  textAlign: 'center' as const,
  letterSpacing: '2px',
};

const footerLinks: React.CSSProperties = {
  margin: '0 0 8px',
  fontSize: '12px',
  color: '#64748b',
  textAlign: 'center' as const,
};

const footerLink: React.CSSProperties = {
  color: '#9A7540',
  textDecoration: 'none',
  fontWeight: 500,
};

const footerDisclaimer: React.CSSProperties = {
  margin: 0,
  fontSize: '11px',
  color: '#cbd5e1',
  textAlign: 'center' as const,
  lineHeight: '1.5',
};

const headingStyle: React.CSSProperties = {
  margin: '0 0 10px',
  fontSize: '26px',
  fontWeight: 700,
  color: '#0A0B0D',
  lineHeight: '1.3',
  letterSpacing: '-0.3px',
};

const subheadingStyle: React.CSSProperties = {
  margin: '24px 0 8px',
  fontSize: '13px',
  fontWeight: 700,
  color: '#475569',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.8px',
};

const bodyStyle: React.CSSProperties = {
  margin: '0 0 16px',
  fontSize: '15px',
  color: '#475569',
  lineHeight: '1.7',
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
