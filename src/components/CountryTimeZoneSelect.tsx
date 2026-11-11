'use client';

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

export function CountryTimeZoneSelect({
  country,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  country?: string | null;
  value?: string | null;
  onChange: (timezone: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  const countryName = normalizeCountryName(country);
  const groups = new Map<string, typeof TIME_ZONES>();
  for (const zone of TIME_ZONES) {
    const group = groups.get(zone.countryName) ?? [];
    group.push(zone);
    groups.set(zone.countryName, group);
  }
  const countries = [...groups.keys()].sort((a, b) => a.localeCompare(b));
  const matchingCountry = countries.find(name => name.toLowerCase() === countryName.toLowerCase());
  const orderedCountries = matchingCountry
    ? [matchingCountry, ...countries.filter(name => name !== matchingCountry)]
    : countries;
  const knownValue = TIME_ZONES.some(zone => zone.name === value || zone.group.includes(value ?? ''));

  return (
    <select aria-label={ariaLabel} value={value || ''} onChange={event => onChange(event.target.value)} className={className}>
      <option value="">{countryName ? `Select a time zone in ${countryName}` : 'Select a time zone'}</option>
      {value && !knownValue && <option value={value}>{value}</option>}
      {orderedCountries.map(name => (
        <optgroup key={name} label={name}>
          {groups.get(name)?.map(zone => (
            <option key={zone.name} value={zone.name}>{zone.currentTimeFormat}</option>
          ))}
        </optgroup>
      ))}
      {!countryName && <optgroup label="Other">
        <option value="UTC">UTC</option>
      </optgroup>}
    </select>
  );
}
