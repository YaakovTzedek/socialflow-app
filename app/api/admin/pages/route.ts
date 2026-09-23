import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema, hasDb } from '@/lib/db';

/**
 * GET /api/admin/pages?key=...
 *
 * The Facebook pages SocialFlow holds a page token for, i.e. the pages whose owner
 * signed in and granted them. Built for Reelsi's "new client" form, which can only
 * publish to a page that is listed here. Returns ids, names and the Instagram
 * username only; tokens never leave this route.
 */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== 'socialflow_verify_2026') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!hasDb) return NextResponse.json({ error: 'no_db' }, { status: 503 });
  await ensureSchema();
  const rows = await sql!`SELECT page_id, page_name, ig_id, access_token, updated_at FROM page_tokens ORDER BY updated_at DESC LIMIT 200`;
  const v = process.env.META_GRAPH_VERSION || 'v21.0';
  const pages = await Promise.all(
    rows.map(async (r) => {
      let ig_username: string | null = null;
      if (r.ig_id) {
        try {
          const ctl = new AbortController();
          const t = setTimeout(() => ctl.abort(), 6000);
          const j = await fetch(`https://graph.facebook.com/${v}/${r.ig_id}?fields=username&access_token=${encodeURIComponent(r.access_token)}`, { signal: ctl.signal }).then((x) => x.json());
          clearTimeout(t);
          ig_username = j.username || null;
        } catch {
          ig_username = null;
        }
      }
      return { page_id: r.page_id as string, page_name: (r.page_name as string) || null, ig_id: (r.ig_id as string) || null, ig_username, updated_at: r.updated_at };
    })
  );
  return NextResponse.json({ pages });
}
