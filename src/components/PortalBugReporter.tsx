'use client';

import React, { useState } from 'react';
import { Bug } from 'lucide-react';
import { ReportBugModal } from './ReportBugModal';

export function PortalBugReporter() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-slate-900 text-white p-3 rounded-full shadow-lg hover:bg-slate-800 transition-transform hover:scale-105 group flex items-center gap-2"
        title="Report an issue"
      >
        <Bug className="w-5 h-5 text-[#D4AF7A]" />
        <span className="hidden group-hover:inline-block text-xs font-semibold pr-2">Report Bug</span>
      </button>

      {isOpen && <ReportBugModal onClose={() => setIsOpen(false)} />}
    </>
  );
}
