import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { sql, ensureSchema, hasDb } from '@/lib/db';
import { listInstagramMedia } from '@/lib/meta';

// POST /api/admin/create-automation?key=...
// Body: { page_id, name, public_replies[], dm_message, keywords[],
//         shortcode? , scope?: 'all_posts' | 'specific_post', platform?: 'instagram' | 'facebook' }
// With a shortcode it resolves the IG post to a media id; with scope 'all_posts' it creates a
// catch-all automation (useful when the post does not exist yet, e.g. a reel about to go live).
export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== 'socialflow_verify_2026') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!hasDb) return NextResponse.json({ error: 'no_db' }, { status: 503 });

  const body = await req.json();
  const {
    shortcode,
    page_id,
    name,
    public_replies = [],
    dm_message,
    dm_link = null,
    keywords = [],
    scope = shortcode ? 'specific_post' : 'all_posts',
    platform = 'instagram',
    // ISO timestamp. Backdates created_at so comments posted BEFORE the automation
    // existed are still processed (catch-up after an outage or a DB migration).
    // Threads that already carry a reply from our own account are still skipped
    // by the poller, so this never produces a second reply.
    since = null,
  } = body;

  await ensureSchema();
  const pt = (
    await sql!`SELECT owner_id, access_token, ig_id FROM page_tokens WHERE page_id = ${page_id} LIMIT 1`
  )[0];
  if (!pt) return NextResponse.json({ error: 'no_page_token' }, { status: 404 });

  // Resolve the shortcode → IG media id via permalink match (skipped for all_posts).
  // A caller that already knows the media id (e.g. from /api/admin/media, which
  // lists up to 100 items) can pass `media_id` and skip the 25-item lookup, so
  // older and pinned posts can get automations too.
  let match: { id: string; permalink?: string } | null = null;
  if (scope === 'specific_post') {
    if (body.media_id) {
      match = { id: String(body.media_id) };
    } else {
      const media = await listInstagramMedia(pt.ig_id, pt.access_token);
      match = media.find((m) => (m.permalink || '').includes(shortcode)) || null;
      if (!match) {
        const recent = media.map((m) => ({ id: m.id, permalink: m.permalink }));
        return NextResponse.json({ error: 'media_not_found', hint: 'Post not in recent media', recent });
      }
    }
  }

  const id = randomUUID();
  const createdAt = since ? new Date(since) : new Date();
  await sql!`
    INSERT INTO automations (
      id, owner_id, name, platform, page_id, ig_id, post_id, post_scope,
      keywords, match_type, public_reply_enabled, public_replies,
      dm_enabled, dm_message, dm_link, once_per_user, status, created_at
    ) VALUES (
      ${id}, ${pt.owner_id}, ${name}, ${platform}, ${page_id}, ${pt.ig_id},
      ${match ? match.id : null}, ${scope}, ${keywords}, 'contains', true,
      ${public_replies}, true, ${dm_message}, ${dm_link}, true, 'active', ${createdAt}
    )`;

  return NextResponse.json({
    success: true,
    automation_id: id,
    scope,
    media_id: match ? match.id : null,
    permalink: match ? match.permalink : null,
  });
}
