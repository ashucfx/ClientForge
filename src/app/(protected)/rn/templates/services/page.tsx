import { redirect } from 'next/navigation';
import { requireRnAdmin } from '@/lib/auth/rnAdmin';
import { prisma } from '@/lib/db';
import { RippleNexusShell } from '@/components/shells/RippleNexusShell';
import ServiceTemplatesClient from './ServiceTemplatesClient';

export const dynamic = 'force-dynamic';

export default async function ServiceTemplatesPage() {
  const admin = await requireRnAdmin();
  if (!admin) redirect('/login');

  const initialTemplates = await prisma.rnServiceTemplate.findMany({
    where: { isActive: true },
    include: {
      milestoneTemplates: {
        orderBy: { order: 'asc' },
        include: { taskTemplates: true }
      },
      deliverableTemplates: true,
      onboardingTemplates: true,
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }]
  });

  return (
    <RippleNexusShell>
      <main className="rn-page" style={{ maxWidth: 1400, margin: '0 auto', animation: 'fadeIn 0.5s ease' }}>
        <header style={{ marginBottom: 40 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', background: 'rgba(59, 130, 246, 0.1)',
            borderRadius: 20, color: '#3B82F6', fontSize: 13, fontWeight: 600, marginBottom: 16
          }}>
            Service Blueprints
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 8 }}>
            Service Blueprints Library
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 600 }}>
            {initialTemplates.length} blueprints · Reusable workflows that auto-provision milestones, tasks, and deliverables when onboarding a new client.
          </p>
        </header>
        <ServiceTemplatesClient initialTemplates={initialTemplates} isSuperAdmin={admin.role === 'SUPER_ADMIN'} />
      </main>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
    </RippleNexusShell>
  );
}
