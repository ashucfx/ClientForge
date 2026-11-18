const DEFAULT_CATALYST_TIME_ZONE = 'Asia/Kolkata';

export function getCatalystTeamTimeZone(): string {
  const configured = process.env.CATALYST_TEAM_TIME_ZONE?.trim() || DEFAULT_CATALYST_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: configured });
    return configured;
  } catch {
    return DEFAULT_CATALYST_TIME_ZONE;
  }
}

export function getAdminDisplayName(email?: string | null): string {
  const localPart = email?.split('@')[0]?.replace(/[._+-]+/g, ' ').trim();
  if (!localPart) return 'Catalyst admin';
  return localPart
    .split(/\s+/)
    .map(part => part.charAt(0).toLocaleUpperCase() + part.slice(1))
    .join(' ');
}
