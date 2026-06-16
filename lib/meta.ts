/**
 * Meta Graph API helper functions.
 * All calls go directly to Facebook's Graph API — no database, no third-party backend.
 */

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export const META_APP_ID = process.env.META_APP_ID || '1414848844000934';
export const META_APP_SECRET = process.env.META_APP_SECRET || '';

/**
 * Permissions we request. Driven by the META_SCOPES env var so we can widen
 * the scope set (e.g. add pages_manage_engagement for replying) the moment
 * those permissions become valid in the Meta app — without a code change.
 *
 * Default = the permissions that are already valid for the app today:
 * login + list pages + read posts/comments. To enable replying, add
 * `pages_manage_engagement,pages_manage_posts,pages_read_user_content`
 * to META_SCOPES once they are approved/active in the Meta dashboard.
 */
export const SCOPES =
  process.env.META_SCOPES ||
  ['public_profile', 'pages_show_list', 'pages_read_engagement'].join(',');

export interface InstagramAccount {
  id: string;
  username?: string;
  profile_picture_url?: string;
  followers_count?: number;
  media_count?: number;
}

export interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  category?: string;
  tasks?: string[];
  picture?: { data?: { url?: string } };
  fan_count?: number;
  instagram_business_account?: InstagramAccount;
}

export interface InstagramMedia {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
}

export interface InstagramComment {
  id: string;
  text?: string;
  username?: string;
  timestamp?: string;
  like_count?: number;
}

export interface FacebookPost {
  id: string;
  message?: string;
  story?: string;
  created_time: string;
  permalink_url?: string;
  full_picture?: string;
  comments?: { summary?: { total_count: number } };
  likes?: { summary?: { total_count: number } };
}

export interface FacebookComment {
  id: string;
  message?: string;
  created_time: string;
  like_count?: number;
  comment_count?: number;
  from?: { id: string; name?: string };
}

async function graphGet<T>(
  path: string,
  params: Record<string, string>
): Promise<T> {
  const url = new URL(`${GRAPH_BASE}/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Graph API error (${res.status})`);
  }
  return data as T;
}

async function graphPost<T>(
  path: string,
  body: Record<string, string>
): Promise<T> {
  const url = `${GRAPH_BASE}/${path}`;
  const form = new URLSearchParams(body);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
    cache: 'no-store',
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Graph API error (${res.status})`);
  }
  return data as T;
}

/** Build the Facebook OAuth dialog URL. */
export function getOAuthUrl(redirectUri: string, state: string): string {
  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set('client_id', META_APP_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');
  return url.toString();
}

/** Exchange an OAuth code for a short-lived user access token. */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; expires_in?: number }> {
  return graphGet('oauth/access_token', {
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    redirect_uri: redirectUri,
    code,
  });
}

/** Upgrade a short-lived token to a long-lived (~60 day) token. */
export async function getLongLivedToken(
  shortLivedToken: string
): Promise<{ access_token: string; expires_in?: number }> {
  return graphGet('oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    fb_exchange_token: shortLivedToken,
  });
}

/** Get the logged-in user's basic profile. */
export async function getMe(
  userToken: string
): Promise<{ id: string; name: string }> {
  return graphGet('me', { fields: 'id,name', access_token: userToken });
}

const PAGE_FIELDS =
  'id,name,access_token,category,tasks,fan_count,picture{url},instagram_business_account{id,username,profile_picture_url,followers_count,media_count}';

/** Fetch all records from a paginated edge. */
async function fetchAllPages(startUrl: URL): Promise<FacebookPage[]> {
  const all: FacebookPage[] = [];
  let url: URL | null = startUrl;
  for (let i = 0; i < 10 && url; i++) {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    const data: { data?: FacebookPage[]; paging?: { next?: string } } =
      await res.json();
    if ((data as any).error) {
      throw new Error((data as any).error.message || 'Graph API error');
    }
    if (data.data) all.push(...data.data);
    url = data.paging?.next ? new URL(data.paging.next) : null;
  }
  return all;
}

/** Pages owned by / shared with the user's Business Portfolios (NPE / business pages). */
async function listBusinessPages(userToken: string): Promise<FacebookPage[]> {
  const out: FacebookPage[] = [];
  try {
    const bizRes = await fetch(
      `${GRAPH_BASE}/me/businesses?fields=id,name&limit=50&access_token=${userToken}`,
      { cache: 'no-store' }
    );
    const biz = await bizRes.json();
    if (biz.error || !biz.data) return out;

    for (const b of biz.data as Array<{ id: string }>) {
      for (const edge of ['owned_pages', 'client_pages']) {
        try {
          const start = new URL(`${GRAPH_BASE}/${b.id}/${edge}`);
          start.searchParams.set('fields', PAGE_FIELDS);
          start.searchParams.set('limit', '100');
          start.searchParams.set('access_token', userToken);
          out.push(...(await fetchAllPages(start)));
        } catch {
          /* ignore individual edge failures */
        }
      }
    }
  } catch {
    /* business_management not granted — ignore, /me/accounts is the fallback */
  }
  return out;
}

/**
 * List ALL pages the user manages — merges /me/accounts with pages from the
 * user's Business Portfolios so New Pages Experience / business-owned pages
 * (which /me/accounts can omit) are included too. Deduped by page id.
 */
export async function listPages(userToken: string): Promise<FacebookPage[]> {
  const direct = new URL(`${GRAPH_BASE}/me/accounts`);
  direct.searchParams.set('fields', PAGE_FIELDS);
  direct.searchParams.set('limit', '100');
  direct.searchParams.set('access_token', userToken);

  const [accountPages, businessPages] = await Promise.all([
    fetchAllPages(direct),
    listBusinessPages(userToken),
  ]);

  // Merge, preferring entries that carry an access_token.
  const byId = new Map<string, FacebookPage>();
  for (const p of [...accountPages, ...businessPages]) {
    const existing = byId.get(p.id);
    if (!existing || (!existing.access_token && p.access_token)) {
      byId.set(p.id, { ...existing, ...p });
    }
  }
  return Array.from(byId.values());
}

/** List recent posts for a page (uses the page access token). */
export async function listPagePosts(
  pageId: string,
  pageToken: string
): Promise<FacebookPost[]> {
  // Use published_posts (the page's own posts) with minimal fields so it works
  // with pages_read_engagement at Standard Access. The comment/like summaries
  // are requested best-effort; if they require extra review, we retry without.
  const fullFields =
    'id,message,story,created_time,permalink_url,full_picture,comments.summary(true).limit(0),likes.summary(true).limit(0)';
  const minimalFields =
    'id,message,story,created_time,permalink_url,full_picture';

  try {
    const data = await graphGet<{ data: FacebookPost[] }>(
      `${pageId}/published_posts`,
      { fields: fullFields, limit: '25', access_token: pageToken }
    );
    return data.data || [];
  } catch {
    const data = await graphGet<{ data: FacebookPost[] }>(
      `${pageId}/published_posts`,
      { fields: minimalFields, limit: '25', access_token: pageToken }
    );
    return data.data || [];
  }
}

/** List comments on a post. */
export async function listComments(
  postId: string,
  pageToken: string
): Promise<FacebookComment[]> {
  const data = await graphGet<{ data: FacebookComment[] }>(
    `${postId}/comments`,
    {
      fields: 'id,message,created_time,like_count,comment_count,from',
      order: 'reverse_chronological',
      limit: '50',
      access_token: pageToken,
    }
  );
  return data.data || [];
}

/** Post a new top-level comment on a post. */
export async function commentOnPost(
  postId: string,
  message: string,
  pageToken: string
): Promise<{ id: string }> {
  return graphPost(`${postId}/comments`, {
    message,
    access_token: pageToken,
  });
}

/** Reply to an existing comment. */
export async function replyToComment(
  commentId: string,
  message: string,
  pageToken: string
): Promise<{ id: string }> {
  return graphPost(`${commentId}/comments`, {
    message,
    access_token: pageToken,
  });
}

/* ---------------------------------------------------------------------------
 * Instagram (via the linked Facebook Page token + IG Business account)
 * ------------------------------------------------------------------------- */

/** List recent media for an Instagram business account. */
export async function listInstagramMedia(
  igUserId: string,
  pageToken: string
): Promise<InstagramMedia[]> {
  const data = await graphGet<{ data: InstagramMedia[] }>(`${igUserId}/media`, {
    fields:
      'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
    limit: '25',
    access_token: pageToken,
  });
  return data.data || [];
}

/** List comments on an Instagram media item. */
export async function listInstagramComments(
  mediaId: string,
  pageToken: string
): Promise<InstagramComment[]> {
  const data = await graphGet<{ data: InstagramComment[] }>(
    `${mediaId}/comments`,
    {
      fields: 'id,text,username,timestamp,like_count',
      limit: '50',
      access_token: pageToken,
    }
  );
  return data.data || [];
}

/** Post a new top-level comment on an Instagram media item. */
export async function commentOnInstagramMedia(
  mediaId: string,
  message: string,
  pageToken: string
): Promise<{ id: string }> {
  return graphPost(`${mediaId}/comments`, {
    message,
    access_token: pageToken,
  });
}

/** Reply to an existing Instagram comment. */
export async function replyToInstagramComment(
  commentId: string,
  message: string,
  pageToken: string
): Promise<{ id: string }> {
  return graphPost(`${commentId}/replies`, {
    message,
    access_token: pageToken,
  });
}
