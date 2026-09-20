import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema, hasDb } from '@/lib/db';

const KEY = 'socialflow_verify_2026';

// GET /api/admin/media?key=&page_id=&limit=50
// Lists the IG business account's media (id, caption, permalink, timestamp,
// comments_count) using the stored page token, so automations can be built for
// every post from its real call-to-action without a browser session. Pinned
// posts are ordinary media here; the wider limit makes sure older pinned ones
// are included.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (q.get('key') !== KEY) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!hasDb) return NextResponse.json({ error: 'no_db' }, { status: 503 });
  await ensureSchema();

  const pageId = q.get('page_id');
  const limit = Math.min(Number(q.get('limit') || 50), 100);
  const pt = (
    pageId
      ? await sql!`SELECT page_id, access_token, ig_id FROM page_tokens WHERE page_id = ${pageId} LIMIT 1`
      : await sql!`SELECT page_id, access_token, ig_id FROM page_tokens WHERE ig_id IS NOT NULL ORDER BY updated_at DESC LIMIT 1`
  )[0] as { page_id: string; access_token: string; ig_id: string | null } | undefined;
  if (!pt || !pt.ig_id) return NextResponse.json({ error: 'no_page_token' }, { status: 404 });

  const version = process.env.META_GRAPH_VERSION || 'v21.0';
  const url = new URL(`https://graph.facebook.com/${version}/${pt.ig_id}/media`);
  url.searchParams.set('fields', 'id,caption,media_type,permalink,timestamp,comments_count,like_count');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('access_token', pt.access_token);
  const r = await fetch(url.toString());
  const j = await r.json();
  if (!r.ok) return NextResponse.json({ error: j.error || j }, { status: 502 });

  return NextResponse.json({
    page_id: pt.page_id,
    ig_id: pt.ig_id,
    count: (j.data || []).length,
    media: (j.data || []).map((m: any) => ({
      id: m.id,
      shortcode: (m.permalink || '').split('/').filter(Boolean).pop(),
      type: m.media_type,
      timestamp: m.timestamp,
      comments: m.comments_count,
      likes: m.like_count,
      caption: m.caption || '',
    })),
  });
}
