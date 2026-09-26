import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema, hasDb } from '@/lib/db';

/**
 * POST /api/admin/page-ad-video?key=...   Body: { page_id, video_url, title? }
 *
 * Uploads a video to a page as UNPUBLISHED (published=false): it never appears on the page, it only
 * exists so an ad creative can use it (video_id + page_id). Built for Reelsi's "boost the winners":
 * Meta refuses to boost an Instagram-only reel directly ("must be uploaded to Facebook"), and the
 * Ads MCP's own media upload isn't enabled on every ad account yet. Returns { video_id }. No tokens out.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v21.0'}`;

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== 'socialflow_verify_2026') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!hasDb) return NextResponse.json({ error: 'no_db' }, { status: 503 });
  const { page_id, video_url, title = '' } = await req.json();
  if (!/^\d{5,25}$/.test(String(page_id || '')) || !/^https:\/\//.test(String(video_url || ''))) {
    return NextResponse.json({ error: 'page_id and https video_url are required' }, { status: 400 });
  }
  await ensureSchema();
  const pt = (await sql!`SELECT access_token FROM page_tokens WHERE page_id = ${page_id} LIMIT 1`)[0];
  if (!pt?.access_token) return NextResponse.json({ error: 'no_page_token' }, { status: 404 });

  const body = new URLSearchParams({ file_url: video_url, published: 'false', title: String(title).slice(0, 250), access_token: pt.access_token });
  const res = await fetch(`${GRAPH}/${page_id}/videos`, { method: 'POST', body });
  const j = await res.json().catch(() => ({}));
  if (!j.id) return NextResponse.json({ error: 'upload_failed', meta: j.error || j }, { status: 502 });
  return NextResponse.json({ video_id: j.id });
}
