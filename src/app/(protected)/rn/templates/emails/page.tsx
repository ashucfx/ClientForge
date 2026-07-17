import { redirect } from 'next/navigation';
import { requireRnAdmin } from '@/lib/auth/rnAdmin';
import { prisma } from '@/lib/db';
import { RippleNexusShell } from '@/components/shells/RippleNexusShell';
import EmailTemplatesClient from './EmailTemplatesClient';

export const dynamic = 'force-dynamic';

export default async function EmailTemplatesPage() {
  const admin = await requireRnAdmin();
  if (!admin) redirect('/login');

  const templates = await prisma.rnEmailTemplate.findMany({
    orderBy: { createdAt: 'desc' }
  });

  return (
    <RippleNexusShell>
      <main className="rn-page" style={{ maxWidth: 1200, margin: '0 auto', animation: 'fadeIn 0.5s ease' }}>
        <header style={{ marginBottom: 40 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', background: 'rgba(16, 185, 129, 0.1)',
            borderRadius: 20, color: '#10B981', fontSize: 13, fontWeight: 600, marginBottom: 16
          }}>
            📧 Communication Engine
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 8 }}>
            Email Templates
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 600 }}>
            {templates.length > 0
              ? `${templates.length} templates active · Automated branded emails dispatched to clients on system events.`
              : 'No email templates yet. Seed the defaults or create custom templates below.'}
          </p>
        </header>
        <EmailTemplatesClient initialTemplates={templates} isSuperAdmin={admin.role === 'SUPER_ADMIN'} />
      </main>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
    </RippleNexusShell>
  );
}
