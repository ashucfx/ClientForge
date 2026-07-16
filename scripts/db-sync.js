// scripts/db-sync.js
// Schema sync that works in every environment:
// - DIRECT_URL set            → prisma db push as-is
// - only DATABASE_URL set     → derive the direct URL (Neon: strip "-pooler")
// - no database configured    → skip (build continues; e.g. lint-only CI)
// Additive schema changes only — db push never drops data without --accept-data-loss.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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

if (!process.env.DIRECT_URL) {
  // Neon convention: pooled host is "<endpoint>-pooler.<region>...", the
  // direct endpoint is the same host without "-pooler".
  const derived = dbUrl.replace('-pooler.', '.').replace(/([?&])pgbouncer=true&?/, '$1').replace(/[?&]$/, '');
  process.env.DIRECT_URL = derived;
  console.log('[db-sync] DIRECT_URL not set — derived from DATABASE_URL.');
}

console.log('[db-sync] Running prisma db push…');
const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['prisma', 'db', 'push', '--skip-generate'],
  { stdio: 'inherit', env: process.env, shell: process.platform === 'win32' }
);

process.exit(result.status ?? 1);
