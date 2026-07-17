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
  // Ultra-Premium Obsidian Dark Mode
  const bgMain = '#050505'; // Deep black
  const bgCard = '#0D0E12'; // Slightly elevated dark
  const textMain = '#FFFFFF';
  const textMuted = '#8B949E';
  const accent = '#7C5CFF'; // Ripple Nexus Violet
  const borderGradient = 'linear-gradient(135deg, rgba(124,92,255,0.4), rgba(34,211,238,0.1))';

  return (
    <Html>
      <Head>
        <style>
          {`
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
            body { font-family: 'Inter', -apple-system, sans-serif; background-color: ${bgMain}; color: ${textMain}; margin: 0; padding: 0; }
          `}
        </style>
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: bgMain, color: textMain, fontFamily: "'Inter', sans-serif" }}>
        <Container style={{ margin: '0 auto', padding: '60px 20px', maxWidth: '600px' }}>
          
          {/* Header */}
          <Section style={{ marginBottom: '40px', textAlign: 'center' }}>
            <Text style={{ fontSize: '26px', fontWeight: 800, color: textMain, letterSpacing: '-0.8px', margin: 0 }}>
              Ripple<span style={{ color: accent }}>Nexus</span>
            </Text>
            {headerTitle && (
              <Text style={{ fontSize: '11px', fontWeight: 700, color: textMuted, letterSpacing: '3px', textTransform: 'uppercase', marginTop: '12px' }}>
                {headerTitle}
              </Text>
            )}
          </Section>

          {/* Main Card */}
          <Section style={{ 
            backgroundColor: bgCard, 
            padding: '48px', 
            borderRadius: '24px',
            borderTop: '1px solid rgba(124,92,255,0.3)',
            borderLeft: '1px solid rgba(255,255,255,0.05)',
            borderRight: '1px solid rgba(255,255,255,0.05)',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 40px rgba(124,92,255,0.05)'
          }}>
            {children}
          </Section>

          {/* Footer */}
          <Section style={{ marginTop: '48px', textAlign: 'center' }}>
            <Hr style={{ borderColor: 'rgba(255,255,255,0.08)', margin: '0 0 32px' }} />
            <Text style={{ fontSize: '12px', color: textMuted, margin: '0 0 10px', fontWeight: 500 }}>
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
