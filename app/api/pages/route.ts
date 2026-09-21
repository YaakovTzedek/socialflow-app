import { listPages } from '@/lib/meta';
import { requireUserToken } from '@/lib/auth-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { sql, hasDb, ensureSchema } from '@/lib/db';

const FRESH_MS = 15 * 60 * 1000;   // serve from cache without touching Meta
const STALE_MS = 24 * 60 * 60 * 1000; // older than this: block on a live fetch

function toSafe(pages: Awaited<ReturnType<typeof listPages>>) {
  // Never leak page tokens to the client.
  return pages.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    fan_count: p.fan_count,
    picture: p.picture?.data?.url,
    instagram: p.instagram_business_account
      ? {
          id: p.instagram_business_account.id,
          username: p.instagram_business_account.username,
          picture: p.instagram_business_account.profile_picture_url,
          followers: p.instagram_business_account.followers_count,
        }
      : null,
  }));
}

async function fetchAndStore(token: string, ownerId: string | null) {
  const safe = toSafe(await listPages(token));
  if (hasDb && ownerId) {
    try {
      await ensureSchema();
      await sql!`
        INSERT INTO pages_cache (owner_id, payload, updated_at) VALUES (${ownerId}, ${JSON.stringify(safe)}::jsonb, now())
        ON CONFLICT (owner_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()
      `;
    } catch { /* cache is best effort */ }
  }
  return safe;
}

// GET /api/pages?refresh=1 → the user's pages. Cached per user (Meta's listing is
// slow); a fresh cache answers instantly, a stale one answers instantly and
// refreshes in the background, a missing one blocks on Meta once.
export async function GET(req: NextRequest) {
  const token = await requireUserToken();
  if (!token) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  const session = await getSession();
  const ownerId = session.userId || null;
  const force = req.nextUrl.searchParams.get('refresh') === '1';
  try {
    if (hasDb && ownerId && !force) {
      await ensureSchema();
      const [row] = await sql!`SELECT payload, updated_at FROM pages_cache WHERE owner_id = ${ownerId}`;
      if (row) {
        const age = Date.now() - new Date(row.updated_at).getTime();
        if (age < FRESH_MS) return NextResponse.json({ pages: row.payload, cached: true, age_ms: age });
        if (age < STALE_MS) {
          // Next 14 has no server-side "after": the client sees stale:true and
          // fires /api/pages?refresh=1 in the background.
          return NextResponse.json({ pages: row.payload, cached: true, stale: true, age_ms: age });
        }
      }
    }
    const pages = await fetchAndStore(token, ownerId);
    return NextResponse.json({ pages, cached: false });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
