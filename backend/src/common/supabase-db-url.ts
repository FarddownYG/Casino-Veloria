/**
 * Supabase connection-string helpers.
 *
 * Supabase's *direct* connection (`db.<ref>.supabase.co`) is IPv6-only, so it is
 * unreachable from IPv4-only hosts (e.g. Render's free tier) → Prisma errors with
 * `P1001 Can't reach database server`. The fix is the *Supavisor session pooler*
 * (`aws-N-<region>.pooler.supabase.com:5432`, IPv4), whose username is
 * `postgres.<ref>`.
 *
 * These pure helpers detect a direct URL and build the pooler equivalent so the
 * app can self-heal at startup (see `scripts/db-deploy.cjs` and `main.ts`).
 */

const DIRECT_RE =
  /^postgres(?:ql)?:\/\/([^:/?#]+):([^@]+)@db\.([a-z0-9]+)\.supabase\.co(?::\d+)?\/([^?]+)/i;

export function isSupabaseDirectUrl(url: string): boolean {
  return /@db\.[a-z0-9]+\.supabase\.co/i.test(url);
}

export interface ParsedDirect {
  user: string;
  password: string;
  ref: string;
  db: string;
}

export function parseDirect(url: string): ParsedDirect | null {
  const m = DIRECT_RE.exec(url);
  if (!m) return null;
  return { user: m[1], password: m[2], ref: m[3], db: m[4] };
}

export function poolerUrl(ref: string, password: string, host: string, db = 'postgres'): string {
  // Session pooler (port 5432) supports migrations + prepared statements.
  return `postgresql://postgres.${ref}:${password}@${host}:5432/${db}?sslmode=require`;
}

/**
 * Returns pooler URL candidates for a direct Supabase URL (best shard first),
 * or `[url]` unchanged when it isn't a direct Supabase URL.
 */
export function poolerCandidates(
  url: string,
  region = process.env.SUPABASE_POOLER_REGION || 'eu-north-1',
): string[] {
  const p = parseDirect(url);
  if (!p) return [url];
  const override = process.env.SUPABASE_POOLER_HOST;
  const hosts = override
    ? [override]
    : [`aws-0-${region}.pooler.supabase.com`, `aws-1-${region}.pooler.supabase.com`];
  return hosts.map((h) => poolerUrl(p.ref, p.password, h, p.db));
}
