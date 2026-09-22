import { NextRequest, NextResponse } from 'next/server';
import { sql, hasDb, ensureSchema } from '@/lib/db';
import { isAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

/** Everything the owner's panel shows, in one round trip. */
export async function GET(req: NextRequest) {
  if (!isAdmin()) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!hasDb) return NextResponse.json({ error: 'db_not_configured' }, { status: 503 });
  await ensureSchema();

  const [
    signups, signupStats, signupByLocale,
    deliverySummary, deliveryErrors, recentLogs,
    automations, owners, subscriptions, overrides, segments,
  ] = await Promise.all([
    sql!`SELECT id, phone, role, tool, locale, created_at FROM beta_signups ORDER BY created_at DESC LIMIT 500`,
    sql!`SELECT count(*)::int AS total,
                count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS day,
                count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS week
         FROM beta_signups`,
    sql!`SELECT locale, count(*)::int AS n FROM beta_signups GROUP BY locale ORDER BY n DESC`,
    sql!`SELECT count(*)::int AS triggers,
                count(*) FILTER (WHERE dm_status = 'sent')::int AS dms,
                count(*) FILTER (WHERE dm_status = 'failed')::int AS failed,
                count(*) FILTER (WHERE public_reply_status = 'sent')::int AS replies,
                count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS day
         FROM trigger_logs`,
    sql!`SELECT error_message, count(*)::int AS n, max(created_at) AS last_at
         FROM trigger_logs WHERE error_message IS NOT NULL AND error_message <> ''
           AND dm_status = 'failed'
         GROUP BY 1 ORDER BY n DESC LIMIT 10`,
    sql!`SELECT l.id, l.platform, l.commenter_name, l.comment_text, l.matched_keyword,
                l.public_reply_status, l.dm_status, l.error_message, l.created_at, a.name AS automation
         FROM trigger_logs l LEFT JOIN automations a ON a.id = l.automation_id
         ORDER BY l.created_at DESC LIMIT 60`,
    sql!`SELECT a.id, a.name, a.platform, a.status, a.page_name, a.keywords, a.trigger_count, a.owner_id,
                count(l.id) FILTER (WHERE l.dm_status = 'sent')::int AS leads
         FROM automations a LEFT JOIN trigger_logs l ON l.automation_id = a.id
         GROUP BY a.id ORDER BY leads DESC, a.trigger_count DESC LIMIT 60`,
    sql!`SELECT count(DISTINCT owner_id)::int AS n FROM automations`,
    sql!`SELECT id, owner_id, plan_id, interval, status, trial_ends_at, current_period_end,
                payer_name, payer_email, amount_agorot, currency, created_at
         FROM subscriptions ORDER BY created_at DESC LIMIT 50`,
    sql!`SELECT owner_id, plan_id, note, created_at FROM plan_overrides ORDER BY created_at DESC LIMIT 20`,
    sql!`SELECT segment, owners, triggers, delivery_rate, peak_hour, computed_at FROM segment_stats ORDER BY owners DESC`,
  ]);

  return NextResponse.json({
    signups, signupStats: signupStats[0], signupByLocale,
    delivery: deliverySummary[0], deliveryErrors, recentLogs,
    automations, owners: owners[0]?.n ?? 0, subscriptions, overrides, segments,
    now: new Date().toISOString(),
  });
}

/** Remove one waiting-list row, for a test entry or a removal request. */
export async function DELETE(req: NextRequest) {
  if (!isAdmin()) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!hasDb) return NextResponse.json({ error: 'db_not_configured' }, { status: 503 });
  const id = Number(req.nextUrl.searchParams.get('signup'));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'bad_id' }, { status: 400 });
  await ensureSchema();
  const rows = await sql!`DELETE FROM beta_signups WHERE id = ${id} RETURNING id`;
  return NextResponse.json({ ok: true, deleted: rows.length });
}
