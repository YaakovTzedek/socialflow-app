import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema, hasDb } from '@/lib/db';

/**
 * POST /api/instagram/publish?key=...
 * Body: { page_id, video_url, caption, cover_url?, thumb_offset? (ms), share_to_feed?, trial? }
 *   trial: true            -> publish as a TRIAL reel (non-followers only), Instagram graduates it
 *   trial: 'MANUAL'        -> trial reel you graduate yourself in the app
 *
 * Publishes a Reel through the Instagram Graph API using the stored page token:
 * create a REELS container -> poll until FINISHED -> publish. The video must sit on a
 * public HTTPS URL that Meta can fetch (Supabase/Vercel/tzedek.me all work).
 */
const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v21.0'}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== 'socialflow_verify_2026') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!hasDb) return NextResponse.json({ error: 'no_db' }, { status: 503 });

  const { page_id, video_url, caption = '', cover_url, thumb_offset, share_to_feed = true, trial } = await req.json();
  if (!page_id || !video_url) return NextResponse.json({ error: 'page_id and video_url are required' }, { status: 400 });

  await ensureSchema();
  const pt = (await sql!`SELECT access_token, ig_id FROM page_tokens WHERE page_id = ${page_id} LIMIT 1`)[0];
  if (!pt?.ig_id) return NextResponse.json({ error: 'no_page_token_or_ig' }, { status: 404 });

  const body: Record<string, string> = {
    media_type: 'REELS',
    video_url,
    caption,
    share_to_feed: String(share_to_feed),
    access_token: pt.access_token,
  };
  if (cover_url) body.cover_url = cover_url;
  // Cover frame in ms. Without it Instagram takes frame 0, which is blank on reels whose visuals fade in.
  else if (Number.isFinite(Number(thumb_offset)) && Number(thumb_offset) > 0) body.thumb_offset = String(Math.round(Number(thumb_offset)));
  if (trial) {
    // Trial reels go only to non-followers; SS_PERFORMANCE lets Instagram graduate the winner
    // to the full audience automatically after ~72h, MANUAL leaves that call to us.
    const strategy = trial === 'MANUAL' ? 'MANUAL' : 'SS_PERFORMANCE';
    body.trial_params = JSON.stringify({ graduation_strategy: strategy });
  }

  const create = await fetch(`${GRAPH}/${pt.ig_id}/media`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  }).then((r) => r.json());
  if (!create.id) return NextResponse.json({ step: 'create_container', error: create }, { status: 400 });

  // Meta downloads and transcodes the file; publishing before it is FINISHED fails.
  let status = '';
  for (let i = 0; i < 40; i++) {
    await sleep(5000);
    const st = await fetch(`${GRAPH}/${create.id}?fields=status_code,status&access_token=${encodeURIComponent(pt.access_token)}`).then((r) => r.json());
    status = st.status_code || '';
    if (status === 'FINISHED') break;
    if (status === 'ERROR') return NextResponse.json({ step: 'container_status', error: st }, { status: 400 });
  }
  if (status !== 'FINISHED') return NextResponse.json({ step: 'container_timeout', container_id: create.id, status }, { status: 504 });

  const pub = await fetch(`${GRAPH}/${pt.ig_id}/media_publish`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ creation_id: create.id, access_token: pt.access_token }),
  }).then((r) => r.json());
  if (!pub.id) return NextResponse.json({ step: 'publish', error: pub }, { status: 400 });

  const info = await fetch(`${GRAPH}/${pub.id}?fields=permalink&access_token=${encodeURIComponent(pt.access_token)}`).then((r) => r.json());
  return NextResponse.json({ success: true, media_id: pub.id, permalink: info.permalink || null });
}
