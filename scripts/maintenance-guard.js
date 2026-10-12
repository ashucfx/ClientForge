// Shared guard for standalone database scripts.
// These scripts are never allowed to run against production by default.

function assertMaintenanceDatabase() {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL || process.env.CI) {
    throw new Error('Refusing standalone database script in production, Vercel, or CI');
  }

  if (process.env.ALLOW_MAINTENANCE_DB !== 'true') {
    throw new Error('Set ALLOW_MAINTENANCE_DB=true to run a standalone database script');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for standalone database scripts');
  }

  let host;
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
    throw new Error('DATABASE_URL is not a valid URL');
  }

  const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
  if (localHosts.has(host)) return;

  if (process.env.MAINTENANCE_DB_HOST !== host) {
    throw new Error(
      `Refusing non-local database host "${host}". Set MAINTENANCE_DB_HOST to the exact approved staging host.`,
    );
  }
}

module.exports = { assertMaintenanceDatabase };
