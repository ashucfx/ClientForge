'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ReportBugModal } from './ReportBugModal';

const OPEN_REPORT_ISSUE_EVENT = 'client-portal:open-report-issue';

export function PortalBugReporter() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const isClientWorkspace = pathname.startsWith('/portal/dashboard');

  useEffect(() => {
    const openReportIssue = () => setIsOpen(true);
    window.addEventListener(OPEN_REPORT_ISSUE_EVENT, openReportIssue);
    return () => window.removeEventListener(OPEN_REPORT_ISSUE_EVENT, openReportIssue);
  }, []);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-5 right-5 z-40 items-center gap-2 rounded-full bg-slate-800 py-2.5 pl-3 pr-4 text-white shadow-lg transition-all hover:bg-slate-700 active:scale-95 group ${isClientWorkspace ? 'hidden lg:flex' : 'flex'}`}
        title="Report an issue"
        aria-label="Report an issue"
      >
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" className="text-[#D4AF7A] flex-shrink-0">
          <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 8v4M12 16h.01"/>
        </svg>
        <span className="text-xs font-semibold">Report an Issue</span>
      </button>

      {isOpen && <ReportBugModal onClose={() => setIsOpen(false)} />}
    </>
  );
}
