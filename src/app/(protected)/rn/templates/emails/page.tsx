import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import EmailTemplatesClient from './EmailTemplatesClient';

export const dynamic = 'force-dynamic';

export default async function EmailTemplatesPage() {
  const admin = await getAdminSession();
  if (!admin) redirect('/login');
  
  if (admin.role !== 'SUPER_ADMIN' && admin.role !== 'PROJECT_MANAGER') {
    return <div style={{ padding: 40, textAlign: 'center' }}>Permission Denied</div>;
  }

  const templates = await prisma.rnEmailTemplate.findMany({
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="rn-page">
      <div className="rn-page-header">
        <h1 className="rn-page-title">Email Templates</h1>
        <p className="rn-page-sub">Manage automated communication templates sent to clients.</p>
      </div>
      <EmailTemplatesClient initialTemplates={templates} />
    </div>
  );
}
