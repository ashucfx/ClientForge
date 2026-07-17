import * as React from 'react';
import {
  Html, Head, Preview, Body, Container, Section, Text, Img, Link, Hr
} from '@react-email/components';

interface RnEmailShellProps {
  preview: string;
  headerTitle?: string;
  children: React.ReactNode;
}

export function RnEmailShell({ preview, headerTitle, children }: RnEmailShellProps) {
  // Deep dark mode theme: Obsidian background, crisp white text, subtle electric blue accents
  const bgMain = '#0A0B0D';
  const bgCard = '#141519';
  const textMain = '#F4F5FA';
  const textMuted = '#94A3B8';
  const accent = '#3B82F6'; // Electric Blue

  return (
    <Html>
      <Head>
        <style>
          {`
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            body { font-family: 'Inter', -apple-system, sans-serif; background-color: ${bgMain}; color: ${textMain}; margin: 0; padding: 0; }
          `}
        </style>
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: bgMain, color: textMain, fontFamily: "'Inter', sans-serif" }}>
        <Container style={{ margin: '0 auto', padding: '40px 20px', maxWidth: '600px' }}>
          
          {/* Header */}
          <Section style={{ marginBottom: '40px', textAlign: 'center' }}>
            {/* You can replace this with a real image logo if available. For now, a sleek text logo. */}
            <Text style={{ fontSize: '24px', fontWeight: 700, color: textMain, letterSpacing: '-0.5px', margin: 0 }}>
              Ripple<span style={{ color: accent }}>Nexus</span>
            </Text>
            {headerTitle && (
              <Text style={{ fontSize: '12px', fontWeight: 600, color: textMuted, letterSpacing: '2px', textTransform: 'uppercase', marginTop: '8px' }}>
                {headerTitle}
              </Text>
            )}
          </Section>

          {/* Main Card */}
          <Section style={{ 
            backgroundColor: bgCard, 
            padding: '40px', 
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.05)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)'
          }}>
            {children}
          </Section>

          {/* Footer */}
          <Section style={{ marginTop: '40px', textAlign: 'center' }}>
            <Hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '0 0 24px' }} />
            <Text style={{ fontSize: '12px', color: textMuted, margin: '0 0 8px' }}>
              Ripple Nexus Operations &bull; Premium Client Portal
            </Text>
            <Text style={{ fontSize: '12px', color: textMuted, margin: 0 }}>
              &copy; {new Date().getFullYear()} The Ripple Nexus. All rights reserved.
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}

// ─────────────────────────────────────────────
// Shared Components
// ─────────────────────────────────────────────

export const RnHeading = ({ children }: { children: React.ReactNode }) => (
  <Text style={{ fontSize: '20px', fontWeight: 600, color: '#F4F5FA', margin: '0 0 24px', letterSpacing: '-0.3px' }}>
    {children}
  </Text>
);

export const RnText = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <Text style={{ fontSize: '15px', lineHeight: '24px', color: '#CBD5E1', margin: '0 0 16px', ...style }}>
    {children}
  </Text>
);

export const RnButton = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Section style={{ textAlign: 'center', marginTop: '32px', marginBottom: '16px' }}>
    <Link 
      href={href} 
      style={{
        display: 'inline-block',
        backgroundColor: '#3B82F6',
        color: '#FFFFFF',
        fontWeight: 600,
        fontSize: '14px',
        padding: '14px 28px',
        borderRadius: '8px',
        textDecoration: 'none',
        boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)'
      }}
    >
      {children}
    </Link>
  </Section>
);

export const RnMetric = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '12px' }}>
    <Text style={{ fontSize: '12px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 4px' }}>
      {label}
    </Text>
    <Text style={{ fontSize: '18px', fontWeight: highlight ? 700 : 500, color: highlight ? '#3B82F6' : '#F4F5FA', margin: 0 }}>
      {value}
    </Text>
  </div>
);
