import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        action: 'ADMIN_LOGIN',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    const adminIds = Array.from(new Set(logs.map(l => l.adminId)));
    const admins = await prisma.adminUser.findMany({
      where: { id: { in: adminIds } },
      select: { id: true, email: true, role: true, isActive: true },
    });
    const adminMap = new Map(admins.map(a => [a.id, a]));

    const formattedSessions = logs.map(log => {
      const admin = adminMap.get(log.adminId);
      const meta = (log.changes && typeof log.changes === 'object' ? log.changes : {}) as Record<string, any>;
      return {
        id: log.id,
        adminId: log.adminId,
        email: admin?.email ?? meta.email ?? 'Unknown',
        role: admin?.role ?? meta.role ?? 'EDITOR',
        isActive: admin?.isActive ?? true,
        ip: meta.ip ?? 'unknown',
        userAgent: meta.userAgent ?? 'unknown',
        createdAt: log.createdAt,
      };
    });

    return NextResponse.json({ sessions: formattedSessions });
  } catch (error) {
    console.error('Failed to fetch session logs:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
