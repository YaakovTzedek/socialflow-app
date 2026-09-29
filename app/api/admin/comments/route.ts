import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema, hasDb } from '@/lib/db';

const KEY = 'socialflow_verify_2026';

// GET /api/admin/comments?key=&page_id=&media_id=
// Every top-level comment on one Instagram post (id, username, text, time), all pages of it, read with
// the stored page token. Built for the Reelsi giveaway draw (10.10.2026): the draw needs the full list,
// not only the comments an automation happened to handle.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (q.get('key') !== KEY) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!hasDb) return NextResponse.json({ error: 'no_db' }, { status: 503 });
  const pageId = q.get('page_id');
  const mediaId = q.get('media_id');
  if (!pageId || !mediaId || !/^\d+$/.test(mediaId)) return NextResponse.json({ error: 'page_id_and_media_id' }, { status: 400 });
  await ensureSchema();
  const pt = (await sql!`SELECT access_token FROM page_tokens WHERE page_id = ${pageId} LIMIT 1`)[0] as { access_token: string } | undefined;
  if (!pt) return NextResponse.json({ error: 'no_page_token' }, { status: 404 });

  const version = process.env.META_GRAPH_VERSION || 'v21.0';
  const url = new URL(`https://graph.facebook.com/${version}/${mediaId}/comments`);
  url.searchParams.set('fields', 'id,username,text,timestamp,from{id,username}');
  url.searchParams.set('limit', '50');
  url.searchParams.set('access_token', pt.access_token);
  const comments: { id: string; username: string; userId?: string; text: string; timestamp: string }[] = [];
  let next: string | null = url.toString();
  for (let i = 0; next && i < 100; i++) {
    const r: Response = await fetch(next, { cache: 'no-store' });
    const j = await r.json();
    if (!r.ok) return NextResponse.json({ error: j.error || j, partial: comments.length }, { status: 502 });
    for (const c of j.data || []) comments.push({ id: c.id, username: c.username || c.from?.username || '', userId: c.from?.id, text: c.text || '', timestamp: c.timestamp });
    next = j.paging?.next || null;
  }
  return NextResponse.json({ media_id: mediaId, count: comments.length, comments });
}
