import { NextRequest, NextResponse } from 'next/server';
import { sql, hasDb, ensureSchema } from '@/lib/db';
import { isAdmin } from '@/lib/admin';
import { generateCode, isValidCode } from '@/lib/affiliates';

export const dynamic = 'force-dynamic';

/** Everything the owner's panel shows, in one round trip. */
export async function GET(req: NextRequest) {
  if (!isAdmin()) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!hasDb) return NextResponse.json({ error: 'db_not_configured' }, { status: 503 });
  await ensureSchema();

  const [
    signups, signupStats, signupByLocale,
    deliverySummary, deliveryErrors, recentLogs,
    automations, owners, subscriptions, overrides, segments, affiliates,
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
    sql!`
      SELECT a.code, a.name, a.phone, a.email, a.note, a.rate_percent, a.months, a.status, a.clicks, a.created_at,
             (SELECT count(*)::int FROM affiliate_referrals r WHERE r.code = a.code) AS referrals,
             COALESCE((SELECT sum(c.commission_agorot)::bigint FROM affiliate_commissions c WHERE c.code = a.code), 0) AS earned_agorot,
             COALESCE((SELECT sum(c.commission_agorot)::bigint FROM affiliate_commissions c WHERE c.code = a.code AND c.paid_at IS NULL), 0) AS pending_agorot
      FROM affiliates a ORDER BY a.created_at DESC`,
  ]);

  return NextResponse.json({
    signups, signupStats: signupStats[0], signupByLocale,
    delivery: deliverySummary[0], deliveryErrors, recentLogs,
    automations, owners: owners[0]?.n ?? 0, subscriptions, overrides, segments, affiliates,
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

/** Admin actions: add a partner, mark commissions paid, grant a plan for a while. */
export async function POST(req: NextRequest) {
  if (!isAdmin()) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!hasDb) return NextResponse.json({ error: 'db_not_configured' }, { status: 503 });
  await ensureSchema();
  const body = await req.json().catch(() => ({}));

  if (body.action === 'create_affiliate') {
    const name = String(body.name || '').trim().slice(0, 120);
    if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 });
    const code = isValidCode(body.code) ? body.code : generateCode(name);
    const rate = Math.min(90, Math.max(1, Number(body.rate_percent) || 50));
    const months = Math.min(60, Math.max(1, Number(body.months) || 12));
    const [row] = await sql!`
      INSERT INTO affiliates (code, name, phone, email, note, rate_percent, months)
      VALUES (${code}, ${name}, ${body.phone ? String(body.phone).slice(0, 40) : null},
              ${body.email ? String(body.email).slice(0, 160) : null},
              ${body.note ? String(body.note).slice(0, 400) : null}, ${rate}, ${months})
      ON CONFLICT (code) DO NOTHING RETURNING code`;
    if (!row) return NextResponse.json({ error: 'code_taken' }, { status: 409 });
    return NextResponse.json({ ok: true, code: row.code });
  }

  if (body.action === 'pay_affiliate') {
    if (!isValidCode(body.code)) return NextResponse.json({ error: 'bad_code' }, { status: 400 });
    const rows = await sql!`UPDATE affiliate_commissions SET paid_at = now() WHERE code = ${body.code} AND paid_at IS NULL RETURNING id`;
    return NextResponse.json({ ok: true, marked: rows.length });
  }

  if (body.action === 'set_affiliate_status') {
    if (!isValidCode(body.code)) return NextResponse.json({ error: 'bad_code' }, { status: 400 });
    const status = body.status === 'paused' ? 'paused' : 'active';
    await sql!`UPDATE affiliates SET status = ${status} WHERE code = ${body.code}`;
    return NextResponse.json({ ok: true });
  }

  // Grant a plan to an account for a number of months, for example the free
  // year a creator gets in exchange for a review. Months 0 makes it permanent.
  if (body.action === 'grant_plan') {
    const owner = String(body.owner_id || '').trim();
    const plan = String(body.plan_id || '').trim();
    if (!owner || !plan) return NextResponse.json({ error: 'missing' }, { status: 400 });
    const months = Math.min(120, Math.max(0, Number(body.months) || 0));
    const expires = months > 0 ? new Date(Date.now() + months * 30.44 * 86400000) : null;
    await sql!`
      INSERT INTO plan_overrides (owner_id, plan_id, note, expires_at)
      VALUES (${owner}, ${plan}, ${String(body.note || 'granted from the panel').slice(0, 200)}, ${expires})
      ON CONFLICT (owner_id) DO UPDATE SET plan_id = EXCLUDED.plan_id, note = EXCLUDED.note, expires_at = EXCLUDED.expires_at`;
    return NextResponse.json({ ok: true, expires_at: expires });
  }

  return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
}
