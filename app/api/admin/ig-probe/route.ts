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
    fb_ig_5_updated: `${page}/conversations?platform=instagram&fields=id,updated_time&limit=5`,
    fb_ig_2_id: `${page}/conversations?platform=instagram&fields=id&limit=2`,
    fb_ig_1_nofields: `${page}/conversations?platform=instagram&limit=1`,
    ig_user_conversations: `${pt.ig_id}/conversations?platform=instagram&fields=id,updated_time&limit=5`,
  };
  const out: Record<string, unknown> = {};
  for (const [k, path] of Object.entries(variants)) {
    const t0 = Date.now();
    const r = await fetch(`${GRAPH}/${path}&access_token=${tok}`).then((x) => x.json()).catch((e) => ({ error: String(e) }));
    out[k] = { ms: Date.now() - t0, n: r?.data?.length ?? null, error: r?.error?.message || null };
  }
  return NextResponse.json(out);
}
