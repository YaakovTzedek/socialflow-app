import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema, hasDb } from '@/lib/db';

/**
 * POST /api/facebook/publish?key=...
 * Body: { page_id, video_url, description, title? }
 *
 * Publishes a video to the Facebook Page feed with the stored page token.
 * Meta pulls the file from `video_url`, so it must be public HTTPS.
 */
const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v21.0'}`;
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== 'socialflow_verify_2026') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!hasDb) return NextResponse.json({ error: 'no_db' }, { status: 503 });

  const { page_id, video_url, description = '', title } = await req.json();
  if (!page_id || !video_url) return NextResponse.json({ error: 'page_id and video_url are required' }, { status: 400 });

  await ensureSchema();
  const pt = (await sql!`SELECT access_token FROM page_tokens WHERE page_id = ${page_id} LIMIT 1`)[0];
  if (!pt) return NextResponse.json({ error: 'no_page_token' }, { status: 404 });

  const body: Record<string, string> = { file_url: video_url, description, access_token: pt.access_token };
  if (title) body.title = title;

  const res = await fetch(`https://graph-video.facebook.com/${process.env.META_GRAPH_VERSION || 'v21.0'}/${page_id}/videos`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  }).then((r) => r.json());

  if (!res.id) return NextResponse.json({ step: 'upload', error: res }, { status: 400 });

  // The post id is only available once the video finishes processing; return what we have.
  const info = await fetch(`${GRAPH}/${res.id}?fields=permalink_url,status&access_token=${encodeURIComponent(pt.access_token)}`)
    .then((r) => r.json())
    .catch(() => ({}));

  return NextResponse.json({ success: true, video_id: res.id, permalink: info.permalink_url || null, status: info.status || null });
}
