'use client';

import React, { useState } from 'react';
import { ReportBugModal } from './ReportBugModal';

export function PortalBugReporter() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 bg-slate-800 text-white pl-3 pr-4 py-2.5 rounded-full shadow-lg hover:bg-slate-700 active:scale-95 transition-all group"
        title="Report an issue"
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
