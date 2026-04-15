// src/emails/career/base/EmailBase.tsx
// Official Ripple Nexus branded email base
// Colors: Primary #1f56d4 · Green #3FBD8B · Dark #0f172a · Gray #666666

import {
  Html, Head, Body, Container, Section, Row, Column,
  Text, Hr, Preview, Img,
} from '@react-email/components';
import * as React from 'react';

// Hosted logo URL — JPG with white background
const LOGO_URL = 'https://clientforge.theripplenexus.com/Logo.jpg';

interface EmailBaseProps {
  preview: string;
  children: React.ReactNode;
  accentColor?: string;
  subBrand?: string;
}

export function EmailBase({
  preview,
  children,
  accentColor = '#1f56d4',
  subBrand = 'ClientForge Boost',
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

          {/* Header bar */}
          <Section style={{ ...header, borderTop: `4px solid ${accentColor}` }}>
            <Row>
              <Column style={{ width: '56px', paddingRight: '14px', verticalAlign: 'middle' }}>
                <Img
                  src={LOGO_URL}
                  width="44"
                  height="44"
                  alt="Ripple Nexus"
                  style={{ borderRadius: '10px', display: 'block' }}
                />
              </Column>
              <Column style={{ verticalAlign: 'middle' }}>
                <Text style={brandPrimary}>Ripple Nexus</Text>
                <Text style={{ ...brandSub, color: accentColor }}>{subBrand}</Text>
              </Column>
              <Column style={{ verticalAlign: 'middle', textAlign: 'right' as const }}>
                <Text style={{ ...headerLink, margin: 0 }}>Career Booster Services</Text>
              </Column>
            </Row>
          </Section>

          {/* Thin accent line */}
          <div style={{ height: '2px', background: `linear-gradient(90deg, ${accentColor} 0%, transparent 100%)`, margin: 0 }} />

          {/* Content */}
          <Section className="email-pad" style={contentPad}>
            {children}
          </Section>

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footer}>
            <Row>
              <Column style={{ textAlign: 'center' as const }}>
                <Text style={footerBrand}>Ripple Nexus</Text>
                <Text style={footerTagline}>Pioneering Digital Governance. Securely. Scalably. Compliantly.</Text>
                <Text style={footerLinks}>
                  <a href="https://www.theripplenexus.com" style={footerLink}>theripplenexus.com</a>
                  {'  ·  '}
                  <a href="mailto:info@theripplenexus.com" style={footerLink}>info@theripplenexus.com</a>
                </Text>
                <Text style={footerDisclaimer}>
                  © {new Date().getFullYear()} Ripple Nexus. All rights reserved.
                  This email was sent because a ClientForge Boost package is active for this address.
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
  color = '#1f56d4',
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
  color = '#1f56d4',
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <Section
      style={{
        borderLeft: `3px solid ${color}`,
        backgroundColor: `${color}08`,
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
  backgroundColor: '#f1f5f9',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  margin: 0,
  padding: '32px 0',
};

const container: React.CSSProperties = {
  maxWidth: '600px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  overflow: 'hidden',
  boxShadow: '0 2px 20px rgba(0,0,0,0.07)',
};

const header: React.CSSProperties = {
  background: 'linear-gradient(135deg, #0f2756 0%, #1f56d4 100%)',
  padding: '20px 28px',
};

const brandPrimary: React.CSSProperties = {
  margin: 0,
  fontSize: '17px',
  fontWeight: 700,
  color: '#f8fafc',
  lineHeight: '1.2',
  letterSpacing: '-0.2px',
};

const brandSub: React.CSSProperties = {
  margin: '2px 0 0',
  fontSize: '10px',
  fontWeight: 600,
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
};

const headerLink: React.CSSProperties = {
  fontSize: '10px',
  color: '#93c5fd',
  letterSpacing: '0.3px',
  textDecoration: 'none',
};

const contentPad: React.CSSProperties = {
  padding: '36px 32px',
};

const divider: React.CSSProperties = {
  borderColor: '#e2e8f0',
  borderWidth: '1px',
  margin: 0,
};

const footer: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  padding: '24px 32px',
};

const footerBrand: React.CSSProperties = {
  margin: '0 0 2px',
  fontSize: '13px',
  fontWeight: 700,
  color: '#1f56d4',
  textAlign: 'center' as const,
};

const footerTagline: React.CSSProperties = {
  margin: '0 0 10px',
  fontSize: '10px',
  color: '#94a3b8',
  textAlign: 'center' as const,
  letterSpacing: '0.3px',
  fontStyle: 'italic',
};

const footerLinks: React.CSSProperties = {
  margin: '0 0 8px',
  fontSize: '12px',
  color: '#64748b',
  textAlign: 'center' as const,
};

const footerLink: React.CSSProperties = {
  color: '#1f56d4',
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
  color: '#0f172a',
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
