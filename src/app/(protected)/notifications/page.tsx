import { prisma } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const session = await getAdminSession();
  if (!session) redirect('/login');

  const notifications = await prisma.notification.findMany({
    where: { adminId: session.adminId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // Mark all as read when visited
  if (notifications.some(n => !n.isRead)) {
    await prisma.notification.updateMany({
      where: { adminId: session.adminId, isRead: false },
      data: { isRead: true },
    });
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Global Activity & Notifications</h1>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No recent activity.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {notifications.map((notif) => (
              <li key={notif.id} className={`p-4 transition hover:bg-slate-50 ${notif.isRead ? 'opacity-80' : 'bg-blue-50/30'}`}>
                <div className="flex items-start gap-4">
                  <div className={`mt-1 p-2 rounded-full ${
                    notif.type === 'WARNING' ? 'bg-amber-100 text-amber-600' :
                    notif.type === 'ERROR' ? 'bg-red-100 text-red-600' :
                    notif.type === 'SUCCESS' ? 'bg-green-100 text-green-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {notif.type === 'WARNING' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />}
                      {notif.type === 'ERROR' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />}
                      {notif.type === 'SUCCESS' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />}
                      {notif.type === 'INFO' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{notif.title}</p>
                    <p className="text-sm text-slate-600 mt-1 break-words">{notif.message}</p>
                    <p className="text-xs text-slate-400 mt-2">
                      {new Date(notif.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {notif.link && (
                    <Link href={notif.link} className="text-sm text-blue-600 font-medium hover:underline whitespace-nowrap">
                      View details &rarr;
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
