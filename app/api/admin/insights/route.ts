import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema, hasDb } from '@/lib/db';

/** GET /api/admin/insights?key=...&limit=25 — recent IG media with their reel metrics. */
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== 'socialflow_verify_2026') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!hasDb) return NextResponse.json({ error: 'no_db' }, { status: 503 });
  await ensureSchema();
  const pt = (await sql!`SELECT access_token, ig_id FROM page_tokens LIMIT 1`)[0];
  if (!pt?.ig_id) return NextResponse.json({ error: 'no_ig' }, { status: 404 });
  const v = process.env.META_GRAPH_VERSION || 'v21.0';
  const limit = req.nextUrl.searchParams.get('limit') || '25';
  const token = encodeURIComponent(pt.access_token);

  const media = await fetch(
    `https://graph.facebook.com/${v}/${pt.ig_id}/media?fields=id,caption,permalink,media_product_type,timestamp,like_count,comments_count&limit=${limit}&access_token=${token}`
  ).then((r) => r.json());

  const rows = [];
  for (const m of media.data || []) {
    const ins = await fetch(
      `https://graph.facebook.com/${v}/${m.id}/insights?metric=views,reach,likes,comments,shares,saved,total_interactions,ig_reels_avg_watch_time&access_token=${token}`
    ).then((r) => r.json());
    const vals: Record<string, number> = {};
    for (const d of ins.data || []) vals[d.name] = d.values?.[0]?.value ?? 0;
    rows.push({
      id: m.id,
      permalink: m.permalink,
      timestamp: m.timestamp,
      headline: (m.caption || '').split('\n')[0].slice(0, 60),
      like_count: m.like_count,
      comments_count: m.comments_count,
      metrics: vals,
      insights_error: ins.error?.message || null,
    });
  }
  return NextResponse.json({ count: rows.length, rows });
}
