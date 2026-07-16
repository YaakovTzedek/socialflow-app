import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { sql, ensureSchema, hasDb } from '@/lib/db';
import { listInstagramMedia } from '@/lib/meta';

// POST /api/admin/create-automation?key=...
// Body: { shortcode, page_id, name, public_replies[], dm_message, keywords[] }
// Resolves the IG post shortcode to a media id and creates the automation.
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
    keywords = [],
  } = body;

  await ensureSchema();
  const pt = (
    await sql!`SELECT owner_id, access_token, ig_id FROM page_tokens WHERE page_id = ${page_id} LIMIT 1`
  )[0];
  if (!pt) return NextResponse.json({ error: 'no_page_token' }, { status: 404 });

  // Resolve the shortcode → IG media id via permalink match.
  const media = await listInstagramMedia(pt.ig_id, pt.access_token);
  const match = media.find((m) => (m.permalink || '').includes(shortcode));
  if (!match) {
    return NextResponse.json({
      error: 'media_not_found',
      hint: 'Post not in recent media',
      recent: media.map((m) => ({ id: m.id, permalink: m.permalink })),
    });
  }

  const id = randomUUID();
  await sql!`
    INSERT INTO automations (
      id, owner_id, name, platform, page_id, ig_id, post_id, post_scope,
      keywords, match_type, public_reply_enabled, public_replies,
      dm_enabled, dm_message, dm_link, once_per_user, status
    ) VALUES (
      ${id}, ${pt.owner_id}, ${name}, 'instagram', ${page_id}, ${pt.ig_id},
      ${match.id}, 'specific_post', ${keywords}, 'contains', true,
      ${public_replies}, true, ${dm_message}, null, true, 'active'
    )`;

  return NextResponse.json({
    success: true,
    automation_id: id,
    media_id: match.id,
    permalink: match.permalink,
  });
}
