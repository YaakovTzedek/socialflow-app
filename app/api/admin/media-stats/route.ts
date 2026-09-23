import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema, hasDb } from '@/lib/db';

/**
 * GET /api/admin/media-stats?key=...&page_id=...&ids=<ig media ids, comma>&automations=<ids, comma>
 *
 * Reel metrics for named Instagram media on a named page, plus how many comments
 * each named automation turned into private messages. Built for Reelsi's
 * dashboard. /api/admin/insights answers a different question (the latest media
 * of whichever page token comes first) and cannot be pointed at a page.
 */
const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v21.0'}`;
const METRICS = 'views,reach,likes,comments,shares,saved,total_interactions,ig_reels_avg_watch_time';

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (q.get('key') !== 'socialflow_verify_2026') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!hasDb) return NextResponse.json({ error: 'no_db' }, { status: 503 });
  const pageId = q.get('page_id') || '';
  const ids = (q.get('ids') || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 60);
  const autos = (q.get('automations') || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 60);
  if (!pageId) return NextResponse.json({ error: 'page_id required' }, { status: 400 });

  await ensureSchema();
  const pt = (await sql!`SELECT access_token FROM page_tokens WHERE page_id = ${pageId} LIMIT 1`)[0];
  if (!pt) return NextResponse.json({ error: 'no_page_token' }, { status: 404 });
  const token = encodeURIComponent(pt.access_token);

  const media: Record<string, unknown> = {};
  await Promise.all(ids.map(async (id) => {
    const [info, ins] = await Promise.all([
      fetch(`${GRAPH}/${id}?fields=permalink,timestamp,like_count,comments_count&access_token=${token}`).then((r) => r.json()),
      fetch(`${GRAPH}/${id}/insights?metric=${METRICS}&access_token=${token}`).then((r) => r.json()),
    ]);
    const vals: Record<string, number> = {};
    for (const d of ins.data || []) vals[d.name] = d.values?.[0]?.value ?? 0;
    media[id] = {
      permalink: info.permalink || null,
      timestamp: info.timestamp || null,
      like_count: info.like_count ?? null,
      comments_count: info.comments_count ?? null,
      metrics: vals,
      error: info.error?.message || ins.error?.message || null,
    };
  }));

  const automations: Record<string, { triggers: number; dms: number; replies: number }> = {};
  if (autos.length) {
    const rows = await sql!`
      SELECT automation_id::text AS id,
             count(*)::int AS triggers,
             count(*) FILTER (WHERE dm_status = 'sent')::int AS dms,
             count(*) FILTER (WHERE public_reply_status = 'sent')::int AS replies
      FROM trigger_logs WHERE automation_id::text = ANY(${autos}) GROUP BY 1`;
    for (const r of rows) automations[r.id] = { triggers: r.triggers, dms: r.dms, replies: r.replies };
  }

  return NextResponse.json({ page_id: pageId, media, automations });
}
