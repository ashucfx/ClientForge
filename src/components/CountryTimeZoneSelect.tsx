'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { getTimeZones } from '@vvo/tzdb';

const TIME_ZONES = getTimeZones({ includeUtc: true, locale: 'en' });

function normalizeCountryName(country?: string | null) {
  const value = country?.trim();
  if (!value) return '';
  if (/^[A-Z]{2}$/.test(value)) {
    try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(value) ?? value; }
    catch { return value; }
  }
  return value;
}

function utcOffset(minutes: number) {
  const sign = minutes < 0 ? '−' : '+';
  const absolute = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
}

export function CountryTimeZoneSelect({
  country,
  value,
  onChange,
  ariaLabel,
  disabled,
  className,
}: {
  country?: string | null;
  value?: string | null;
  onChange: (timezone: string) => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const preferredCountry = normalizeCountryName(country);
  const selectedZone = TIME_ZONES.find(zone => zone.name === value || zone.group.includes(value ?? ''));

  const visibleZones = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    const filtered = TIME_ZONES.filter(zone => {
      if (!search) return true;
      const searchable = [
        zone.name,
        ...zone.group,
        zone.countryName,
        zone.countryCode,
        zone.mainCities.join(' '),
        zone.alternativeName,
        zone.currentTimeFormat,
        zone.rawFormat,
        utcOffset(zone.currentTimeOffsetInMinutes),
      ].join(' ').toLocaleLowerCase();
      return searchable.includes(search) || (search.length === 2 && zone.countryCode.toLowerCase() === search);
    });
    return filtered.sort((a, b) => {
      const aPreferred = a.countryName.toLocaleLowerCase() === preferredCountry.toLocaleLowerCase();
      const bPreferred = b.countryName.toLocaleLowerCase() === preferredCountry.toLocaleLowerCase();
      if (aPreferred !== bPreferred) return aPreferred ? -1 : 1;
      return a.currentTimeOffsetInMinutes - b.currentTimeOffsetInMinutes || a.countryName.localeCompare(b.countryName) || a.name.localeCompare(b.name);
    });
  }, [preferredCountry, query]);

  useEffect(() => {
    if (!open) return;
    const focusFrame = window.requestAnimationFrame(() => searchRef.current?.focus());
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('pointerdown', closeOnOutside);
    };
  }, [open]);

  useEffect(() => setActiveIndex(0), [query]);

  const choose = (zoneName: string) => {
    onChange(zoneName);
    setOpen(false);
    setQuery('');
  };

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(index => Math.min(index + 1, visibleZones.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(index => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && visibleZones[activeIndex]) {
      event.preventDefault();
      choose(visibleZones[activeIndex].name);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative w-full min-w-0 sm:w-auto">
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => { setOpen(current => !current); setQuery(''); }}
        className={`flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-[#E8DDD0] bg-white px-3 py-2 text-left text-sm font-medium text-slate-800 shadow-sm transition hover:border-[#B8935B] hover:bg-[#FFFEFC] focus:outline-none focus:ring-2 focus:ring-[#B8935B]/30 disabled:cursor-not-allowed disabled:opacity-60 sm:w-[250px] ${className ?? ''}`}
      >
        <span className="min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Time zone</span>
          <span className="block truncate text-xs">{selectedZone ? `${selectedZone.countryName} · ${selectedZone.mainCities[0] || selectedZone.name}` : value || 'Choose a time zone'}</span>
        </span>
        <svg aria-hidden="true" className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="none">
          <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#E8DDD0] bg-white shadow-[0_16px_48px_rgba(25,30,40,0.18)] sm:w-[340px]">
          <div className="border-b border-[#F0E9E0] bg-[#FFFEFC] p-3">
            <div className="flex items-center gap-2 rounded-xl border border-[#E8DDD0] bg-white px-3 py-2.5 focus-within:border-[#B8935B] focus-within:ring-2 focus-within:ring-[#B8935B]/20">
              <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="none">
                <circle cx="8.75" cy="8.75" r="5.75" stroke="currentColor" strokeWidth="1.5" />
                <path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Search country, city or time zone"
                aria-label={`Search ${ariaLabel.toLowerCase()}`}
                className="w-full min-w-0 border-0 bg-transparent p-0 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:ring-0"
              />
              {query && <button type="button" onClick={() => setQuery('')} className="rounded p-0.5 text-slate-400 hover:text-slate-700" aria-label="Clear search">×</button>}
            </div>
            <p className="mt-2 px-1 text-[10px] text-slate-400">Search countries such as India, cities such as Singapore, or IANA names.</p>
          </div>

          <div role="listbox" aria-label={ariaLabel} className="max-h-64 overflow-y-auto overscroll-contain p-1.5">
            {visibleZones.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-slate-500">No matching time zones found.</p>
            ) : visibleZones.map((zone, index) => {
              const selected = value === zone.name || zone.group.includes(value ?? '');
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  key={zone.name}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(zone.name)}
                  className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition ${selected ? 'bg-[#F7F1E8]' : index === activeIndex ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F7F1E8] text-[10px] font-bold text-[#96723F]">{zone.countryCode || 'UTC'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-slate-800">{zone.countryName} · {zone.mainCities[0] || zone.alternativeName}</span>
                      <span className="shrink-0 text-[10px] font-medium text-slate-500">{utcOffset(zone.currentTimeOffsetInMinutes)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-slate-500">{zone.name} · {zone.currentAbbreviation}</span>
                  </span>
                  {selected && <svg aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-[#9A7540]" viewBox="0 0 20 20" fill="none"><path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </button>
              );
            })}
          </div>
          <div className="border-t border-[#F0E9E0] px-3 py-2 text-[10px] text-slate-400">
            {visibleZones.length} time zone{visibleZones.length === 1 ? '' : 's'} · use ↑ ↓ and Enter to select
          </div>
        </div>
      )}
    </div>
  );
}
