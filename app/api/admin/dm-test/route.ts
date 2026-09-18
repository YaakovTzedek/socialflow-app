import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema, hasDb } from '@/lib/db';

/**
 * GET /api/admin/dm-test?key=...&comment_id=...  — attempts one Instagram private reply and
 * returns Meta's raw response, so error codes/subcodes are visible instead of a generic message.
 */
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== 'socialflow_verify_2026') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!hasDb) return NextResponse.json({ error: 'no_db' }, { status: 503 });
  const commentId = req.nextUrl.searchParams.get('comment_id');
  if (!commentId) return NextResponse.json({ error: 'comment_id required' }, { status: 400 });

  await ensureSchema();
  const pt = (await sql!`SELECT access_token, ig_id, page_id FROM page_tokens LIMIT 1`)[0];
  if (!pt) return NextResponse.json({ error: 'no_page_token' }, { status: 404 });

  const v = process.env.META_GRAPH_VERSION || 'v21.0';
  const attempts: Record<string, unknown>[] = [];
  for (const target of [`${pt.ig_id}/messages`, `me/messages`, `${pt.page_id}/messages`]) {
    const res = await fetch(`https://graph.facebook.com/${v}/${target}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { comment_id: commentId },
        message: { text: 'בדיקה' },
        access_token: pt.access_token,
      }),
    });
    attempts.push({ target, status: res.status, body: await res.json() });
  }
  return NextResponse.json({ ig_id: pt.ig_id, page_id: pt.page_id, attempts });
}
