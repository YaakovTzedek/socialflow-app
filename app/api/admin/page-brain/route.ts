import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema, hasDb } from '@/lib/db';

/**
 * GET /api/admin/page-brain?key=...&page_id=...&days=90
 *
 * What one page's own comment history says, for Reelsi's learning loop: which comment keywords
 * turned into delivered DMs, the hour (Israel time) comments peak, and whether a link in the DM
 * lifts delivery. Counted from trigger_logs, never modelled. The owner-level brain (lib/brain.ts)
 * mixes every page an owner holds, which is why this one filters by page. Numbers only, no tokens.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== 'socialflow_verify_2026') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!hasDb) return NextResponse.json({ error: 'no_db' }, { status: 503 });
  const pageId = req.nextUrl.searchParams.get('page_id') || '';
  if (!/^\d{5,25}$/.test(pageId)) return NextResponse.json({ error: 'page_id' }, { status: 400 });
  const days = Math.max(1, Math.min(365, Number(req.nextUrl.searchParams.get('days')) || 90));
  await ensureSchema();
  const since = new Date(Date.now() - days * 86400000);

  const [totals] = await sql!`
    SELECT count(*)::int AS triggers,
           count(*) FILTER (WHERE l.dm_status = 'sent')::int AS leads
    FROM trigger_logs l JOIN automations a ON a.id = l.automation_id
    WHERE a.page_id = ${pageId} AND l.created_at >= ${since}`;

  const keywords = await sql!`
    SELECT lower(l.matched_keyword) AS keyword,
           count(*)::int AS triggers,
           count(*) FILTER (WHERE l.dm_status = 'sent')::int AS leads
    FROM trigger_logs l JOIN automations a ON a.id = l.automation_id
    WHERE a.page_id = ${pageId} AND l.created_at >= ${since}
      AND l.matched_keyword IS NOT NULL AND l.matched_keyword <> ''
    GROUP BY lower(l.matched_keyword)
    ORDER BY leads DESC, triggers DESC LIMIT 8`;

  const hours = await sql!`
    SELECT extract(hour FROM l.created_at AT TIME ZONE 'Asia/Jerusalem')::int AS hour, count(*)::int AS triggers
    FROM trigger_logs l JOIN automations a ON a.id = l.automation_id
    WHERE a.page_id = ${pageId} AND l.created_at >= ${since}
    GROUP BY 1 ORDER BY triggers DESC`;

  const [link] = await sql!`
    SELECT
      count(l.id) FILTER (WHERE a.dm_link IS NOT NULL AND a.dm_link <> '')::int AS with_total,
      count(l.id) FILTER (WHERE a.dm_link IS NOT NULL AND a.dm_link <> '' AND l.dm_status = 'sent')::int AS with_leads,
      count(l.id) FILTER (WHERE a.dm_link IS NULL OR a.dm_link = '')::int AS without_total,
      count(l.id) FILTER (WHERE (a.dm_link IS NULL OR a.dm_link = '') AND l.dm_status = 'sent')::int AS without_leads
    FROM trigger_logs l JOIN automations a ON a.id = l.automation_id
    WHERE a.page_id = ${pageId} AND l.created_at >= ${since}`;

  const rate = (p: number, w: number) => (w > 0 ? Math.round((p / w) * 100) : null);
  const t = totals as any;
  const hourRows = hours as any[];
  return NextResponse.json({
    pageId,
    days,
    triggers: t?.triggers ?? 0,
    leads: t?.leads ?? 0,
    // A peak read off a handful of comments is noise, so it needs at least 20 behind it.
    peakHourIL: (t?.triggers ?? 0) >= 20 && hourRows[0] ? hourRows[0].hour : null,
    keywords: (keywords as any[]).map((k) => ({ keyword: k.keyword, triggers: k.triggers, leads: k.leads, rate: rate(k.leads, k.triggers) })),
    linkRate: rate((link as any)?.with_leads ?? 0, (link as any)?.with_total ?? 0),
    noLinkRate: rate((link as any)?.without_leads ?? 0, (link as any)?.without_total ?? 0),
    computedAt: new Date().toISOString(),
  });
}
