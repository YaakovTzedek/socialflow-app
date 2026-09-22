import { NextRequest, NextResponse } from 'next/server';
import { sql, hasDb, ensureSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Read-only diagnostics, guarded by ADMIN_CLAIM_CODE. Exists because the
 * database is unreachable from outside the deployment, so a production
 * question like "the public reply went out but the private message did not"
 * cannot be answered from a shell.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.ADMIN_CLAIM_CODE;
  const code = req.nextUrl.searchParams.get('code') || '';
  if (!expected || code.length !== expected.length || code !== expected) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (!hasDb) return NextResponse.json({ error: 'db_not_configured' }, { status: 503 });
  await ensureSchema();

  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 60));

  const summary = await sql!`
    SELECT public_reply_status, dm_status, count(*)::int AS n
    FROM trigger_logs GROUP BY 1, 2 ORDER BY n DESC`;

  const errors = await sql!`
    SELECT dm_status, error_message, count(*)::int AS n, max(created_at) AS last_at
    FROM trigger_logs
    WHERE error_message IS NOT NULL AND error_message <> ''
    GROUP BY 1, 2 ORDER BY n DESC LIMIT 20`;

  const recent = await sql!`
    SELECT l.id, l.platform, l.post_id, l.commenter_name, l.matched_keyword,
           l.public_reply_status, l.dm_status, l.error_message, l.created_at,
           a.name AS automation, a.dm_enabled, a.dm_message IS NOT NULL AND a.dm_message <> '' AS has_dm_text,
           a.dm_link, a.once_per_user, a.status AS automation_status
    FROM trigger_logs l LEFT JOIN automations a ON a.id = l.automation_id
    ORDER BY l.created_at DESC LIMIT ${limit}`;

  const automations = await sql!`
    SELECT id, name, platform, status, dm_enabled, public_reply_enabled,
           dm_message IS NOT NULL AND dm_message <> '' AS has_dm_text,
           dm_link, keywords, trigger_count, created_at
    FROM automations ORDER BY created_at DESC LIMIT 30`;

  const [dm] = await sql!`SELECT count(*)::int AS n FROM dm_sent`;

  // Which database is actually serving production. Host and version only: the
  // connection string itself is a secret and never leaves the deployment.
  const raw = process.env.SOCIALFLOW_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
  let host = 'unknown';
  let projectRef: string | null = null;
  try {
    const u = new URL(raw);
    host = u.host;
    // On the Supabase pooler the username is postgres.<project ref>. The ref is
    // public (it is the project's subdomain); the password never leaves here.
    const dot = decodeURIComponent(u.username).indexOf('.');
    if (dot > 0) projectRef = decodeURIComponent(u.username).slice(dot + 1);
  } catch { /* malformed or absent */ }
  const [ver] = await sql!`SELECT version() AS v, current_database() AS db, current_schema() AS schema`;
  // On the Supabase pooler the connecting user is postgres.<project ref>, which
  // is how a deployment can name the project holding its data without ever
  // exposing the password.
  let poolUser: string | null = null;
  try {
    const [u] = await sql!`SELECT usename FROM pg_stat_activity WHERE pid = pg_backend_pid()`;
    poolUser = (u?.usename as string) || null;
  } catch { /* not every provider exposes it */ }

  return NextResponse.json({ database: { host, projectRef, user: poolUser, name: ver?.db, schema: ver?.schema, version: String(ver?.v || '').slice(0, 60) }, summary, errors, automations, dmSentRows: dm?.n ?? 0, recent });
}
