'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface SearchResult {
  type: string;
  title: string;
  subtitle: string;
  url: string;
  badge?: string;
}

export function GlobalCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchResults = async () => {
      if (query.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results || []);
      } catch (e) {
        console.error('Search failed', e);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchResults, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div 
        className="w-full max-w-2xl bg-[#121214] border border-[#27272A] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[#27272A] flex items-center">
          <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent text-white focus:outline-none text-lg"
            placeholder="Search clients, projects, or invoices..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white text-xs bg-[#27272A] px-2 py-1 rounded">ESC</button>
        </div>

        <div className="overflow-y-auto p-2" style={{ maxHeight: '400px' }}>
          {query.length === 0 && (
            <div className="p-4">
              <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Quick Actions</div>
              <button 
                onClick={() => { router.push('/invoices/new'); setIsOpen(false); }}
                className="w-full text-left p-3 rounded-lg hover:bg-[#27272A] text-white flex items-center gap-3 transition-colors"
              >
                <div className="w-8 h-8 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center">+</div>
                Create New Invoice
              </button>
              <button 
                onClick={() => { router.push('/rn/projects/new'); setIsOpen(false); }}
                className="w-full text-left p-3 rounded-lg hover:bg-[#27272A] text-white flex items-center gap-3 transition-colors mt-1"
              >
                <div className="w-8 h-8 rounded bg-purple-500/20 text-purple-400 flex items-center justify-center">+</div>
                Create New Project
              </button>
            </div>
          )}

          {loading && <div className="p-8 text-center text-gray-500">Searching...</div>}
          
          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="p-8 text-center text-gray-500">No results found for &quot;{query}&quot;</div>
          )}

          {!loading && results.length > 0 && (
            <div className="p-2">
              <div className="text-xs font-semibold text-gray-500 mb-2 px-2 uppercase tracking-wider">Results</div>
              {results.map((result, idx) => (
                <button
                  key={idx}
                  onClick={() => { router.push(result.url); setIsOpen(false); }}
                  className="w-full text-left p-3 rounded-lg hover:bg-[#27272A] flex justify-between items-center transition-colors group"
                >
                  <div>
                    <div className="text-sm font-medium text-white group-hover:text-[var(--brand)] transition-colors">{result.title}</div>
                    <div className="text-xs text-gray-500 mt-1">{result.type} &bull; {result.subtitle}</div>
                  </div>
                  {result.badge && (
                    <span className="text-[10px] px-2 py-1 rounded-full border border-gray-700 text-gray-400 uppercase tracking-wider">
                      {result.badge.replace('_', ' ')}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="fixed inset-0 z-[-1]" onClick={() => setIsOpen(false)} />
    </div>
  );
}
