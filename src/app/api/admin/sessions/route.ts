import { NextResponse, type NextRequest } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getSetting, setSetting } from '@/lib/systemSettings';

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

    const revokedSessions = (await getSetting<string[]>('REVOKED_SESSIONS')) || [];
    const blockedIps = (await getSetting<string[]>('BLOCKED_IPS')) || [];

    const adminIds = Array.from(new Set(logs.map(l => l.adminId)));
    const admins = await prisma.adminUser.findMany({
      where: { id: { in: adminIds } },
      select: { id: true, email: true, role: true, isActive: true },
    });
    const adminMap = new Map(admins.map(a => [a.id, a]));

    const formattedSessions = logs.map(log => {
      const admin = adminMap.get(log.adminId);
      const meta = (log.changes && typeof log.changes === 'object' ? log.changes : {}) as Record<string, any>;
      const sessionId = meta.sessionId as string | undefined;
      const ip = (meta.ip as string) ?? 'unknown';

      const isRevoked =
        (sessionId && revokedSessions.includes(sessionId)) ||
        revokedSessions.includes(log.id) ||
        meta.status === 'REVOKED';

      const isBlocked = ip !== 'unknown' && blockedIps.includes(ip.trim());
      const isCurrent = !!(sessionId && session.sessionId && sessionId === session.sessionId);

      return {
        id: log.id,
        sessionId: sessionId ?? log.id,
        adminId: log.adminId,
        email: admin?.email ?? meta.email ?? 'Unknown',
        role: admin?.role ?? meta.role ?? 'EDITOR',
        isActive: admin?.isActive ?? true,
        ip,
        userAgent: meta.userAgent ?? 'unknown',
        createdAt: log.createdAt,
        isRevoked,
        isBlocked,
        isCurrent,
        status: isRevoked ? 'REVOKED' : (isBlocked ? 'BLOCKED' : 'ACTIVE'),
      };
    });

    return NextResponse.json({
      sessions: formattedSessions,
      blockedIps,
      currentSessionId: session.sessionId ?? null,
    });
  } catch (error) {
    console.error('Failed to fetch session logs:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized. Super Admin access required.' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { action, sessionId, logId, ip, reason } = body;

    const revokedSessions = new Set((await getSetting<string[]>('REVOKED_SESSIONS')) || []);
    const blockedIps = new Set((await getSetting<string[]>('BLOCKED_IPS')) || []);

    if (action === 'LOGOUT_ALL_OTHER_DEVICES') {
      const currentSessionId = session.sessionId;

      const allLoginLogs = await prisma.auditLog.findMany({
        where: { action: 'ADMIN_LOGIN' },
        orderBy: { createdAt: 'desc' },
      });

      let countRevoked = 0;
      for (const log of allLoginLogs) {
        const meta = (log.changes && typeof log.changes === 'object' ? log.changes : {}) as Record<string, any>;
        const sid = meta.sessionId as string | undefined;

        // Strictly protect and DO NOT revoke current session
        const isCurrent = Boolean(
          (currentSessionId && sid && sid === currentSessionId) ||
          (currentSessionId && log.id === currentSessionId)
        );

        if (isCurrent) {
          continue;
        }

        if (sid) revokedSessions.add(sid);
        revokedSessions.add(log.id);

        if (meta.status !== 'REVOKED') {
          meta.status = 'REVOKED';
          meta.revokedAt = new Date().toISOString();
          meta.revokedBy = session.adminId;
          meta.revokeReason = 'Logged out via Logout All Other Devices';
          await prisma.auditLog.update({
            where: { id: log.id },
            data: { changes: meta },
          }).catch(() => {});
          countRevoked++;
        }
      }

      await setSetting('REVOKED_SESSIONS', Array.from(revokedSessions), session.adminId);

      // Record administrative action (preserving audit logs)
      await prisma.auditLog.create({
        data: {
          tenantId: 'catalyst',
          adminId: session.adminId,
          action: 'ADMIN_ALL_OTHER_SESSIONS_REVOKED',
          entity: 'Session',
          entityId: currentSessionId || session.adminId,
          changes: {
            revokedCount: countRevoked,
            revokedBy: session.adminId,
            preservedCurrentSessionId: currentSessionId,
            at: new Date().toISOString(),
          },
        },
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: `Logged out from all other devices (${countRevoked} session${countRevoked === 1 ? '' : 's'} terminated). Your current session remains active and audit logs are safely preserved.`,
        revokedCount: countRevoked,
      });
    }

    if (action === 'REVOKE') {
      if (!sessionId && !logId) {
        return NextResponse.json({ error: 'sessionId or logId required to revoke' }, { status: 400 });
      }

      // Safeguard: Never revoke current active session
      if (session.sessionId && (sessionId === session.sessionId || logId === session.sessionId)) {
        return NextResponse.json({ error: 'You cannot revoke your own active session from this panel. Use regular logout to sign out.' }, { status: 400 });
      }

      if (sessionId) revokedSessions.add(sessionId);
      if (logId) revokedSessions.add(logId);

      await setSetting('REVOKED_SESSIONS', Array.from(revokedSessions), session.adminId);

      // Update audit log record if logId provided (DO NOT DELETE the audit record)
      if (logId) {
        const existing = await prisma.auditLog.findUnique({ where: { id: logId } });
        if (existing) {
          const ch = (existing.changes && typeof existing.changes === 'object' ? existing.changes : {}) as Record<string, any>;
          ch.status = 'REVOKED';
          ch.revokedAt = new Date().toISOString();
          ch.revokedBy = session.adminId;
          await prisma.auditLog.update({
            where: { id: logId },
            data: { changes: ch },
          });
        }
      }

      // Record administrative action
      await prisma.auditLog.create({
        data: {
          tenantId: 'catalyst',
          adminId: session.adminId,
          action: 'ADMIN_SESSION_REVOKED',
          entity: 'Session',
          entityId: sessionId ?? logId ?? 'unknown',
          changes: { sessionId, logId, revokedBy: session.adminId, at: new Date().toISOString() },
        },
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: 'Session has been revoked. That device has been logged out.',
      });
    }

    if (action === 'BLOCK_IP') {
      if (!ip || ip === 'unknown') {
        return NextResponse.json({ error: 'Valid IP required to block' }, { status: 400 });
      }

      const cleanIp = ip.trim();
      blockedIps.add(cleanIp);
      await setSetting('BLOCKED_IPS', Array.from(blockedIps), session.adminId);

      // Also revoke all login sessions matching this IP
      const matchingLogs = await prisma.auditLog.findMany({
        where: { action: 'ADMIN_LOGIN' },
      });
      for (const log of matchingLogs) {
        const meta = (log.changes || {}) as Record<string, any>;
        if (meta.ip === cleanIp) {
          if (meta.sessionId) revokedSessions.add(meta.sessionId);
          revokedSessions.add(log.id);
        }
      }
      await setSetting('REVOKED_SESSIONS', Array.from(revokedSessions), session.adminId);

      // Record administrative action
      await prisma.auditLog.create({
        data: {
          tenantId: 'catalyst',
          adminId: session.adminId,
          action: 'ADMIN_IP_BLOCKED',
          entity: 'IP',
          entityId: cleanIp,
          changes: { ip: cleanIp, reason: reason ?? 'Unrecognised suspicious session', blockedBy: session.adminId, at: new Date().toISOString() },
        },
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: `IP ${cleanIp} has been blocked and all active sessions from this IP were revoked.`,
      });
    }

    if (action === 'UNBLOCK_IP') {
      if (!ip) {
        return NextResponse.json({ error: 'IP required to unblock' }, { status: 400 });
      }

      const cleanIp = ip.trim();
      blockedIps.delete(cleanIp);
      await setSetting('BLOCKED_IPS', Array.from(blockedIps), session.adminId);

      // Record administrative action
      await prisma.auditLog.create({
        data: {
          tenantId: 'catalyst',
          adminId: session.adminId,
          action: 'ADMIN_IP_UNBLOCKED',
          entity: 'IP',
          entityId: cleanIp,
          changes: { ip: cleanIp, unblockedBy: session.adminId, at: new Date().toISOString() },
        },
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: `IP ${cleanIp} has been unblocked.`,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Failed to process session action:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getAdminSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized. Super Admin access required.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      await prisma.auditLog.deleteMany({
        where: {
          id,
          action: 'ADMIN_LOGIN',
        },
      });
      return NextResponse.json({ success: true, message: 'Session log deleted' });
    } else {
      return NextResponse.json({
        error: 'Bulk deletion of session audit logs is disabled for compliance. Use "Logout All Other Devices" to terminate sessions while keeping your current session and audit records safe.',
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Failed to delete session log(s):', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
