// scripts/db-sync.js
// Explicitly opt-in local schema sync. This script must never run as part of a
// production build or deployment.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

if (process.env.NODE_ENV === 'production' || process.env.VERCEL || process.env.CI) {
  console.error('[db-sync] Refusing to run in deployment, production, or CI environments.');
  process.exit(1);
}

if (process.env.ALLOW_DB_PUSH !== 'true') {
  console.error('[db-sync] Refusing to run without ALLOW_DB_PUSH=true.');
  console.error('[db-sync] Use reviewed Prisma migrations for staging and production.');
  process.exit(1);
}

// Local dev: hosted platforms inject env vars, but locally they live in
// .env/.env.local (which the Prisma CLI reads itself). Mirror that here.
if (!process.env.DATABASE_URL) {
  for (const file of ['.env', '.env.local']) {
    const p = path.join(__dirname, '..', file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.log('[db-sync] DATABASE_URL not set — skipping schema sync.');
  process.exit(0);
}

try {
  const host = new URL(dbUrl).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    console.error(`[db-sync] Refusing non-local database host: ${host}`);
    process.exit(1);
  }
} catch {
  console.error('[db-sync] DATABASE_URL is not a valid URL.');
  process.exit(1);
}

if (!process.env.DIRECT_URL) {
  // Neon convention: pooled host is "<endpoint>-pooler.<region>...", the
  // direct endpoint is the same host without "-pooler".
  const derived = dbUrl.replace('-pooler.', '.').replace(/([?&])pgbouncer=true&?/, '$1').replace(/[?&]$/, '');
  process.env.DIRECT_URL = derived;
  console.log('[db-sync] DIRECT_URL not set — derived from DATABASE_URL.');
}

console.log('[db-sync] Running explicitly authorized local prisma db push...');
const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['prisma', 'db', 'push'],
  { stdio: 'inherit', env: process.env, shell: process.platform === 'win32' }
);

if (result.status !== 0) {
  console.error('[db-sync] Local schema sync failed.');
  process.exit(result.status ?? 1);
}

process.exit(0);
