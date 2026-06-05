/* eslint-disable */
/**
 * Production DB deploy step (run by the `prisma:deploy` npm script).
 *
 * If DATABASE_URL is a Supabase *direct* (IPv6) URL — unreachable from Render's
 * IPv4 free tier — this probes the Supavisor *session pooler* shards using the
 * real credentials, picks the one that actually connects, runs
 * `prisma migrate deploy` against it, and persists the resolved URL to a temp
 * file so the runtime process (main.ts) reuses the exact same working URL.
 *
 * No-op transform when DATABASE_URL is already a pooler/local URL.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { poolerCandidates, isSupabaseDirectUrl } = require('../dist/common/supabase-db-url.js');

const RESOLVED_PATH = path.join(os.tmpdir(), 'veloria-resolved-db-url');
const raw = process.env.DATABASE_URL || '';

function hostOf(url) {
  try {
    return url.split('@')[1].split(/[:/]/)[0];
  } catch {
    return '(unknown host)';
  }
}

function probe(url) {
  const r = spawnSync('npx', ['prisma', 'db', 'execute', '--url', url, '--stdin'], {
    input: 'SELECT 1;',
    encoding: 'utf8',
    timeout: 30000,
    env: { ...process.env },
  });
  return r.status === 0;
}

let chosen = raw;

if (isSupabaseDirectUrl(raw)) {
  console.log('[db] DATABASE_URL is a Supabase direct (IPv6) URL — resolving the IPv4 Session pooler…');
  // Try pooler shards first, then the direct URL itself (works if IPv4 add-on is on).
  const candidates = [...poolerCandidates(raw), raw];
  chosen = null;
  for (const c of candidates) {
    process.stdout.write(`[db] probing ${hostOf(c)} … `);
    if (probe(c)) {
      console.log('reachable ✓');
      chosen = c;
      break;
    }
    console.log('unreachable');
  }
  if (!chosen) {
    console.error(
      '[db] Could not reach any Supabase host. On Render free (IPv4), set DATABASE_URL to the ' +
        '"Session pooler" string (Supabase → Connect → Session pooler), or set SUPABASE_POOLER_HOST.',
    );
    process.exit(1);
  }
}

try {
  fs.writeFileSync(RESOLVED_PATH, chosen, 'utf8');
} catch (e) {
  console.warn(`[db] could not persist resolved URL: ${e.message}`);
}

const migrate = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: chosen },
});
process.exit(migrate.status == null ? 1 : migrate.status);
