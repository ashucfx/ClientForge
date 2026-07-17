import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import ServiceTemplatesClient from './ServiceTemplatesClient';

export const dynamic = 'force-dynamic';

export default async function ServiceTemplatesPage() {
  const admin = await getAdminSession();
  if (!admin) redirect('/login');
  
  if (admin.role !== 'SUPER_ADMIN' && admin.role !== 'PROJECT_MANAGER') {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
        You do not have permission to view templates.
      </div>
    );
  }

  // Pre-fetch templates for initial render
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
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="rn-page">
      <div className="rn-page-header">
        <h1 className="rn-page-title">Service Templates</h1>
        <p className="rn-page-sub">Manage reusable service configurations, milestones, and deliverables.</p>
      </div>
      <ServiceTemplatesClient initialTemplates={initialTemplates} />
    </div>
  );
}
