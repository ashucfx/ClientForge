import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { redirect } from 'next/navigation';
import { Bug, CheckCircle2, CircleDashed } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function BugsAdminPage() {
  const admin = await getAdminSession();
  if (!admin) redirect('/login');

  const bugs = await db.bugReport.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Bug className="w-6 h-6 text-red-500" />
              Bug Reports
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Issues reported by live clients from the portal.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {bugs.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center text-slate-500">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-4" />
              <h3 className="text-lg font-bold text-slate-900 mb-2">No bugs reported!</h3>
              <p className="text-sm">Everything seems to be running smoothly.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold text-slate-700">Report Details</th>
                  <th className="px-6 py-4 font-semibold text-slate-700">Client</th>
                  <th className="px-6 py-4 font-semibold text-slate-700">Status</th>
                  <th className="px-6 py-4 font-semibold text-slate-700">Reported At</th>
                  <th className="px-6 py-4 font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bugs.map((bug) => (
                  <tr key={bug.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 max-w-md">
                      <p className="text-slate-900 line-clamp-2">{bug.description}</p>
                      {bug.url && (
                        <a href={bug.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-1 inline-block">
                          View Page URL
                        </a>
                      )}
                      {bug.adminNotes && (
                        <div className="mt-2 text-xs bg-amber-50 text-amber-800 p-2 rounded">
                          <strong>Admin Notes:</strong> {bug.adminNotes}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {bug.clientName ? (
                        <>
                          <div className="font-semibold text-slate-900">{bug.clientName}</div>
                          <div className="text-slate-500 text-xs">{bug.clientEmail}</div>
                        </>
                      ) : (
                        <span className="text-slate-400 italic">Anonymous</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        bug.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-700' : 
                        bug.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {bug.status === 'OPEN' && <CircleDashed className="w-3.5 h-3.5" />}
                        {bug.status === 'RESOLVED' && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {bug.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                      {new Date(bug.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <form action={async (formData) => {
                        'use server';
                        const newStatus = formData.get('status') as string;
                        if (newStatus) {
                          await db.bugReport.update({ where: { id: bug.id }, data: { status: newStatus } });
                        }
                      }}>
                        <select 
                          name="status"
                          defaultValue={bug.status}
                          className="text-xs border border-slate-200 rounded px-2 py-1 mr-2"
                        >
                          <option value="OPEN">Open</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="RESOLVED">Resolved</option>
                          <option value="CLOSED">Closed</option>
                        </select>
                        <button type="submit" className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded hover:bg-slate-800">
                          Update
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
