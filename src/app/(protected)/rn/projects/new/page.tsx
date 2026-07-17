import { redirect } from 'next/navigation';
import { requireRnAdmin } from '@/lib/auth/rnAdmin';
import { prisma } from '@/lib/db';
import { NewProjectForm } from './NewProjectForm';

export const dynamic = 'force-dynamic';

export default async function RnNewProjectPage() {
  const admin = await requireRnAdmin();
  if (!admin) redirect('/login');

  // Fetch directly from DB — no client-side fetch, no auth issues
  const templates = await prisma.rnServiceTemplate.findMany({
    where: { isActive: true },
    select: { id: true, name: true, category: true, pricingModel: true, baseCurrency: true },
    orderBy: [{ category: 'asc' }, { name: 'asc' }]
  });

  // Group by category
  const templatesByCat = templates.reduce((acc: Record<string, any[]>, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});

  return <NewProjectForm templatesByCat={templatesByCat} />;
}
