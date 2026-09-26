import { getSession } from '@/lib/session';
import { listPages, type FacebookPage } from '@/lib/meta';
import { sql, hasDb, ensureSchema } from '@/lib/db';

/** Returns the long-lived user token or null if not authenticated. */
export async function requireUserToken(): Promise<string | null> {
  const session = await getSession();
  if (!session.userAccessToken) return null;
  if (session.tokenExpiresAt && session.tokenExpiresAt < Date.now()) return null;
  return session.userAccessToken;
}

// Live page listings per user token, kept for a few minutes in the warm
// function. Clicking three pages in a row used to walk /me/accounts and every
// Business Portfolio three times.
const LIVE_TTL_MS = 5 * 60 * 1000;
const liveCache = new Map<string, { at: number; pages: Promise<FacebookPage[]> }>();

function listPagesCached(userToken: string, fresh = false): Promise<FacebookPage[]> {
  const hit = liveCache.get(userToken);
  if (!fresh && hit && Date.now() - hit.at < LIVE_TTL_MS) return hit.pages;
  const pages = listPages(userToken);
  liveCache.set(userToken, { at: Date.now(), pages });
  pages.catch(() => liveCache.delete(userToken));
  if (liveCache.size > 200) liveCache.delete(liveCache.keys().next().value as string);
  return pages;
}

/**
 * Resolve the page-scoped access token for a given page id.
 *
 * First from page_tokens, stored for this same owner at login and on every
 * page-list refresh (owner_id is the signed-in user, so this is the same
 * authorization the live listing gives). Only when that misses does it list
 * the user's pages from Meta, which on agency accounts with many portfolios
 * takes several seconds and made /posts sit on "Loading posts..." per click.
 * Pass { live: true } to skip the stored token (retry after a Graph error).
 */
export async function getPageToken(
  userToken: string,
  pageId: string,
  opts: { live?: boolean } = {}
): Promise<string | null> {
  if (!opts.live && hasDb) {
    try {
      const session = await getSession();
      if (session.userId) {
        await ensureSchema();
        const [row] = await sql!`SELECT access_token FROM page_tokens WHERE page_id = ${pageId} AND owner_id = ${session.userId}`;
        if (row?.access_token) return row.access_token as string;
      }
    } catch { /* fall through to the live listing */ }
  }
  const pages = await listPagesCached(userToken, !!opts.live);
  const page = pages.find((p) => p.id === pageId);
  return page?.access_token ?? null;
}

/**
 * Run a Graph call with the page token, retrying once with a freshly listed
 * token if the stored one fails (revoked, or the page changed hands).
 */
export async function withPageToken<T>(userToken: string, pageId: string, fn: (pageToken: string) => Promise<T>): Promise<T | null> {
  const stored = await getPageToken(userToken, pageId);
  if (!stored) return null;
  try {
    return await fn(stored);
  } catch (e) {
    const live = await getPageToken(userToken, pageId, { live: true });
    if (!live || live === stored) throw e;
    return fn(live);
  }
}

/** Upsert the page tokens of one owner in a single round trip. */
export async function storePageTokens(ownerId: string, pages: FacebookPage[]): Promise<void> {
  if (!hasDb) return;
  const rows = pages.filter((p) => p.access_token).map((p) => ({
    page_id: p.id, owner_id: ownerId, page_name: p.name ?? null, access_token: p.access_token, ig_id: p.instagram_business_account?.id ?? null,
  }));
  if (!rows.length) return;
  await ensureSchema();
  await sql!`
    INSERT INTO page_tokens ${sql!(rows, 'page_id', 'owner_id', 'page_name', 'access_token', 'ig_id')}
    ON CONFLICT (page_id) DO UPDATE SET
      owner_id = EXCLUDED.owner_id, page_name = EXCLUDED.page_name,
      access_token = EXCLUDED.access_token, ig_id = EXCLUDED.ig_id, updated_at = now()`;
}
