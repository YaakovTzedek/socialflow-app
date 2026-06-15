import { getSession } from '@/lib/session';
import { listPages } from '@/lib/meta';

/** Returns the long-lived user token or null if not authenticated. */
export async function requireUserToken(): Promise<string | null> {
  const session = await getSession();
  if (!session.userAccessToken) return null;
  if (session.tokenExpiresAt && session.tokenExpiresAt < Date.now()) return null;
  return session.userAccessToken;
}

/**
 * Resolve the page-scoped access token for a given page id.
 * Since we don't use a database, we look it up live from the user's managed pages.
 */
export async function getPageToken(
  userToken: string,
  pageId: string
): Promise<string | null> {
  const pages = await listPages(userToken);
  const page = pages.find((p) => p.id === pageId);
  return page?.access_token ?? null;
}
