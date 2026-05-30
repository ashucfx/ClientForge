import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { IconDocument } from '@/components/Icons';

export const dynamic = 'force-dynamic';

export default async function RnDeliverablesPage({ params }: { params: { token: string } }) {
  const client = await prisma.rnClient.findFirst({
    where: { magicToken: params.token }
  });

  if (!client) notFound();

  // Fetch deliverables
  const deliverables = await prisma.rnDeliverable.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 32 }}>
      <h1 style={{ margin: '0 0 24px', fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconDocument size={28} style={{ color: '#7C5CFF' }} /> Project Deliverables
      </h1>
      
      {deliverables.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: 12, color: '#A1A1AA' }}>
          No deliverables have been uploaded to your project workspace yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {deliverables.map(d => (
            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#F4F5FA', marginBottom: 4 }}>{d.label}</div>
                <div style={{ fontSize: 12, color: '#A1A1AA' }}>
                  {d.originalName} • {(d.sizeBytes / 1024 / 1024).toFixed(2)} MB • Uploaded {new Date(d.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <a href={d.fileUrl} target="_blank" rel="noreferrer" style={{ background: '#7C5CFF', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                  Download
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
