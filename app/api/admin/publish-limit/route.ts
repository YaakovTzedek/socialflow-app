import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema, hasDb } from '@/lib/db';

/** GET /api/admin/publish-limit?key=... — how much of Instagram's 24h publishing quota is used. */
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== 'socialflow_verify_2026') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!hasDb) return NextResponse.json({ error: 'no_db' }, { status: 503 });
  await ensureSchema();
  const pt = (await sql!`SELECT access_token, ig_id FROM page_tokens LIMIT 1`)[0];
  if (!pt?.ig_id) return NextResponse.json({ error: 'no_ig' }, { status: 404 });
  const v = process.env.META_GRAPH_VERSION || 'v21.0';
  const r = await fetch(
    `https://graph.facebook.com/${v}/${pt.ig_id}/content_publishing_limit?fields=config,quota_usage&access_token=${encodeURIComponent(pt.access_token)}`
  ).then((x) => x.json());
  return NextResponse.json(r);
}
