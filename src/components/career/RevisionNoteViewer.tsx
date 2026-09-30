'use client';
// src/components/career/RevisionNoteViewer.tsx
// High-fidelity structured renderer for revision instructions, briefs, and client change-requests.

import React, { useState, useMemo } from 'react';

interface RevisionNoteViewerProps {
  note: string;
  defaultExpanded?: boolean;
}

interface ParsedSection {
  title?: string;
  icon?: string;
  items: string[];
  paragraphs: string[];
}

export function RevisionNoteViewer({ note, defaultExpanded = false }: RevisionNoteViewerProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const sections = useMemo(() => {
    if (!note) return [];
    const rawLines = note.split('\n').map(l => l.trim()).filter(Boolean);
    const parsedSections: ParsedSection[] = [];
    let currentSection: ParsedSection = { items: [], paragraphs: [] };

    const getIconForTitle = (t: string): string => {
      const lower = t.toLowerCase();
      if (lower.includes('experience') || lower.includes('work') || lower.includes('role') || lower.includes('project')) return '💼';
      if (lower.includes('ai') || lower.includes('tech') || lower.includes('tool') || lower.includes('software')) return '🤖';
      if (lower.includes('skill') || lower.includes('competenc') || lower.includes('keyword')) return '⚡';
      if (lower.includes('instruction') || lower.includes('implement') || lower.includes('action')) return '📋';
      if (lower.includes('scope') || lower.includes('objective') || lower.includes('brief')) return '🎯';
      if (lower.includes('summary') || lower.includes('profile') || lower.includes('headline')) return '👤';
      if (lower.includes('education') || lower.includes('certif') || lower.includes('degree')) return '🎓';
      if (lower.includes('area') || lower.includes('section')) return '🏷️';
      return '📌';
    };

    const isHeaderLine = (line: string): boolean => {
      // Ends with a colon and is a title length (<= 85 chars)
      if (line.endsWith(':') && line.length <= 85) return true;
      // Markdown header style
      if (/^#{1,4}\s+/.test(line)) return true;
      // Bold header style
      if (/^\*\*[^*]+\*\*[:]?$/.test(line)) return true;
      return false;
    };

    for (const line of rawLines) {
      if (isHeaderLine(line)) {
        if (currentSection.title || currentSection.items.length > 0 || currentSection.paragraphs.length > 0) {
          parsedSections.push(currentSection);
        }
        const cleanTitle = line
          .replace(/^#{1,4}\s+/, '')
          .replace(/^\*\*|\*\*[:]?$/g, '')
          .replace(/:$/, '')
          .trim();
        currentSection = {
          title: cleanTitle,
          icon: getIconForTitle(cleanTitle),
          items: [],
          paragraphs: [],
        };
      } else {
        const isBullet = /^[-•*]\s+/.test(line) || /^\d+[.)]\s+/.test(line);
        const cleanContent = line
          .replace(/^[-•*]\s+/, '')
          .replace(/^\d+[.)]\s+/, '')
          .trim();

        // If it's a long explanatory paragraph (>90 chars) and not explicitly a bullet
        if (!isBullet && cleanContent.length > 90) {
          currentSection.paragraphs.push(cleanContent);
        } else {
          currentSection.items.push(cleanContent);
        }
      }
    }

    if (currentSection.title || currentSection.items.length > 0 || currentSection.paragraphs.length > 0) {
      parsedSections.push(currentSection);
    }

    return parsedSections;
  }, [note]);

  const totalPoints = useMemo(() => {
    return sections.reduce((acc, s) => acc + s.items.length + s.paragraphs.length, 0);
  }, [sections]);

  const isLong = totalPoints > 7 || note.length > 380;

  if (sections.length === 0) {
    return <p className="text-sm text-slate-500 italic">No detailed notes provided.</p>;
  }

  // If simple single note without sections or bullets
  if (sections.length === 1 && !sections[0].title && sections[0].items.length <= 1 && sections[0].paragraphs.length <= 1) {
    return (
      <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-800 leading-relaxed whitespace-pre-line">
        {note}
      </div>
    );
  }

  return (
    <div className="relative mt-2">
      <div
        className={`transition-all duration-300 ${
          !isExpanded && isLong ? 'max-h-72 overflow-hidden' : ''
        }`}
      >
        <div className="space-y-3 bg-[#FDFBF7]/70 border border-[#EAE2D5] rounded-xl p-3.5 sm:p-4 text-xs shadow-2xs">
          {sections.map((sec, idx) => (
            <div key={idx} className="space-y-2">
              {sec.title && (
                <div className="flex items-center gap-1.5 pb-1 border-b border-[#EAE2D5]/70">
                  <span className="text-sm">{sec.icon}</span>
                  <span className="font-bold text-slate-800 tracking-wide text-xs">
                    {sec.title}
                  </span>
                </div>
              )}

              {sec.paragraphs.length > 0 && (
                <div className="space-y-1.5 pl-1">
                  {sec.paragraphs.map((p, pIdx) => (
                    <div
                      key={pIdx}
                      className="p-2.5 rounded-lg bg-white/80 border border-[#EAE2D5] text-slate-700 leading-relaxed text-xs shadow-2xs"
                    >
                      {p}
                    </div>
                  ))}
                </div>
              )}

              {sec.items.length > 0 && (
                <ul className="space-y-1.5 pl-1">
                  {sec.items.map((item, iIdx) => (
                    <li
                      key={iIdx}
                      className="flex items-start gap-2 text-slate-700 leading-relaxed text-xs"
                    >
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#B8935B] flex-shrink-0" />
                      <span className="min-w-0">{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {/* Gradient fade overlay when collapsed */}
        {!isExpanded && isLong && (
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none rounded-b-xl" />
        )}
      </div>

      {isLong && (
        <button
          type="button"
          onClick={() => setIsExpanded(prev => !prev)}
          className="mt-2.5 text-xs font-bold text-[#9A7540] hover:text-[#7A5B2E] transition-colors inline-flex items-center gap-1.5 bg-[#FAF7F2] hover:bg-[#F3EDE2] border border-[#EAE2D5] px-3.5 py-1.5 rounded-lg shadow-2xs"
        >
          <span>
            {isExpanded
              ? '▴ Collapse brief'
              : `▾ View full revision brief (${totalPoints} points)`}
          </span>
        </button>
      )}
    </div>
  );
}
