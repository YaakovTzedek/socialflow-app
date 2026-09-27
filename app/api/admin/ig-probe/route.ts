import { NextRequest, NextResponse } from 'next/server';
import { sql, hasDb, ensureSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v21.0'}`;

/** Read-only: which shape of the Instagram conversations call a page's inbox answers (27.9, "reduce the amount of data"). */
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== 'socialflow_verify_2026') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!hasDb) return NextResponse.json({ error: 'no_db' }, { status: 503 });
  await ensureSchema();
  const page = String(req.nextUrl.searchParams.get('page') || '');
  const [pt] = await sql!`SELECT access_token, ig_id FROM page_tokens WHERE page_id = ${page} LIMIT 1`;
  if (!pt) return NextResponse.json({ error: 'no_token' }, { status: 404 });
  const tok = encodeURIComponent(pt.access_token as string);
  const variants: Record<string, string> = {
    nofields_1: `${page}/conversations?platform=instagram&limit=1`,
    nofields_10: `${page}/conversations?platform=instagram&limit=10`,
    nofields_25: `${page}/conversations?platform=instagram&limit=25`,
    updated_1: `${page}/conversations?platform=instagram&fields=updated_time&limit=1`,
  };
  const out: Record<string, unknown> = {};
  for (const [k, path] of Object.entries(variants)) {
    const t0 = Date.now();
    const r = await fetch(`${GRAPH}/${path}&access_token=${tok}`).then((x) => x.json()).catch((e) => ({ error: String(e) }));
    out[k] = { ms: Date.now() - t0, n: r?.data?.length ?? null, error: r?.error?.message || null, first: r?.data?.[0] || null };
    if (k === 'nofields_1' && r?.data?.[0]?.id) {
      const t1 = Date.now();
      const m = await fetch(`${GRAPH}/${r.data[0].id}?fields=messages.limit(10){id,created_time,from,to,message,story,attachments}&access_token=${tok}`).then((x) => x.json()).catch((e) => ({ error: String(e) }));
      out.messages_10 = { ms: Date.now() - t1, n: m?.messages?.data?.length ?? null, error: m?.error?.message || null };
    }
  }
  return NextResponse.json(out);
}
