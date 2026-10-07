import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema, hasDb } from '@/lib/db';
import { replyToInstagramComment } from '@/lib/meta';

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

// POST /api/admin/comments?key=  { page_id, comment_ids: string[], message }
// One public reply under each listed Instagram comment, with the stored page token. Built for the
// Grok Bot coupon follow-up (7.10.2026): commenters whose private reply already went out can only be
// reached again publicly. Capped at 50 per call; returns a per-comment result.
export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== KEY) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!hasDb) return NextResponse.json({ error: 'no_db' }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const pageId = String(body.page_id || '');
  const message = String(body.message || '').trim();
  const ids: string[] = Array.isArray(body.comment_ids) ? body.comment_ids.map(String).filter((x: string) => /^\d+$/.test(x)).slice(0, 50) : [];
  if (!pageId || !message || !ids.length) return NextResponse.json({ error: 'page_id_message_comment_ids' }, { status: 400 });
  await ensureSchema();
  const pt = (await sql!`SELECT access_token FROM page_tokens WHERE page_id = ${pageId} LIMIT 1`)[0] as { access_token: string } | undefined;
  if (!pt) return NextResponse.json({ error: 'no_page_token' }, { status: 404 });
  const results: { comment_id: string; ok: boolean; id?: string; error?: string }[] = [];
  for (const id of ids) {
    try {
      const r = await replyToInstagramComment(id, message, pt.access_token);
      results.push({ comment_id: id, ok: true, id: r.id });
    } catch (e) {
      results.push({ comment_id: id, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return NextResponse.json({ sent: results.filter((r) => r.ok).length, results });
}
