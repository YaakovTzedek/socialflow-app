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
const REQUIRED_SCOPES = [
  'public_profile',
  'pages_show_list',
  'pages_read_engagement',
  'pages_read_user_content',
  'pages_manage_engagement',
  'pages_manage_posts',
  'pages_manage_metadata', // REQUIRED to subscribe pages to webhooks
  'pages_messaging',
  'instagram_basic',
  'instagram_manage_comments',
  'instagram_manage_messages', // for Instagram comment → DM
  'instagram_content_publish', // publish reels/photos straight from the app
  'instagram_manage_insights', // reel metrics (views/reach/watch time) for ranking hooks
  'business_management',
];
// Merge any env-provided scopes with the required set (env can't drop required ones).
export const SCOPES = Array.from(
  new Set([
    ...(process.env.META_SCOPES ? process.env.META_SCOPES.split(',') : []),
    ...REQUIRED_SCOPES,
  ])
).join(',');

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

    // All businesses and both edges in parallel: sequential walking took 10-20s
    // on agency accounts with many portfolios.
    const jobs: Promise<FacebookPage[]>[] = [];
    for (const b of biz.data as Array<{ id: string }>) {
      for (const edge of ['owned_pages', 'client_pages']) {
        const start = new URL(`${GRAPH_BASE}/${b.id}/${edge}`);
        start.searchParams.set('fields', PAGE_FIELDS);
        start.searchParams.set('limit', '100');
        start.searchParams.set('access_token', userToken);
        jobs.push(fetchAllPages(start).catch(() => [] as FacebookPage[]));
      }
    }
    for (const pages of await Promise.all(jobs)) out.push(...pages);
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

/**
 * Send a private reply (DM) to the author of a comment. This is the
 * "comment → DM" flow (like ManyChat). Allowed once per comment, within 7 days.
 * Requires the pages_messaging permission.
 */
/**
 * Post a private reply and confirm it actually went out.
 *
 * Meta answers this endpoint with an empty body often enough that parsing it
 * as JSON blind throws "Unexpected end of JSON input", which used to be
 * recorded as the failure reason and hid the real status code. It also answers
 * 200 without a message id under load, and treating that as a delivered
 * message is how a lead silently disappears. So: read the body as text, parse
 * defensively, and insist on a message id before calling it sent.
 */
async function postPrivateReply(commentId: string, message: string, pageToken: string): Promise<{ messageId: string; recipientId?: string }> {
  const res = await fetch(`${GRAPH_BASE}/me/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { comment_id: commentId },
      message: { text: message },
      access_token: pageToken,
    }),
    cache: 'no-store',
  });

  const raw = await res.text();
  let data: any = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { /* Meta returned something that is not JSON */ }

  if (!res.ok || data?.error) {
    const e = data?.error;
    const detail = e ? `${e.message || 'error'}${e.code ? ` (code ${e.code}${e.error_subcode ? `/${e.error_subcode}` : ''})` : ''}` : (raw ? raw.slice(0, 200) : 'empty response');
    const error: any = new Error(`HTTP ${res.status}: ${detail}`);
    error.status = res.status;
    error.metaCode = e?.code;
    error.retryable = isRetryable(res.status, e?.code);
    throw error;
  }

  const messageId = data?.message_id || data?.id;
  if (!messageId) {
    const error: any = new Error(`HTTP ${res.status} with no message id: ${raw ? raw.slice(0, 200) : 'empty response'}`);
    error.status = res.status;
    error.retryable = true;
    throw error;
  }
  return { messageId, recipientId: data?.recipient_id };
}

/**
 * Whether a failure is worth trying again. Meta's transient codes are 1, 2 and
 * 4 (unknown, service, rate limit), 17 and 32 (user and page rate limits), 613
 * (calls too often), plus any 5xx and any 429. A permission or policy refusal
 * is not retried, because it will fail the same way in five minutes.
 */
export function isRetryable(status: number, metaCode?: number): boolean {
  if (status >= 500 || status === 429) return true;
  return [1, 2, 4, 17, 32, 613].includes(Number(metaCode));
}

export async function sendPrivateReply(
  commentId: string,
  message: string,
  pageToken: string
): Promise<{ messageId: string; recipientId?: string }> {
  return postPrivateReply(commentId, message, pageToken);
}

/**
 * Send a private reply (DM) to the author of an Instagram comment.
 * Instagram comment→DM flow. Requires instagram_manage_messages.
 */
export async function sendInstagramPrivateReply(
  igUserId: string,
  commentId: string,
  message: string,
  pageToken: string
): Promise<{ messageId: string; recipientId?: string }> {
  // Instagram private replies go through the PAGE-scoped inbox (`me/messages`) with the page
  // token. Posting to `{ig-user-id}/messages` returns "(#3) Application does not have the
  // capability to make this API call" even when instagram_manage_messages is granted.
  void igUserId;
  return postPrivateReply(commentId, message, pageToken);
}

/* ---------------------------------------------------------------------------
 * Instagram DM inbox (page-scoped conversations)
 *
 * Verified against a real page token (25.9.2026): listing conversations works,
 * but asking for nested messages inside the list times out, so messages are
 * fetched per conversation. Sending goes through the PAGE inbox (me/messages)
 * with the page token; the IG-user messages endpoint is refused.
 * ------------------------------------------------------------------------- */

export interface IgConversation {
  id: string;
  updated_time?: string;
  participants?: { data?: { id: string; username?: string; name?: string }[] };
}

export interface IgMessage {
  id: string;
  created_time?: string;
  from?: { id: string; username?: string; name?: string };
  to?: { data?: { id: string; username?: string; name?: string }[] };
  message?: string;
  /** Present when the message is a reply to (or mention in) a Story. */
  story?: { reply_to?: { id?: string; link?: string }; mention?: { id?: string; link?: string } } & Record<string, any>;
  attachments?: { data?: { mime_type?: string; image_data?: any; video_data?: any; file_url?: string; type?: string }[] };
}

/** The Instagram conversations of a page, newest first. */
export async function listInstagramConversations(
  pageId: string,
  pageToken: string,
  limit = 25
): Promise<IgConversation[]> {
  const data = await graphGet<{ data: IgConversation[] }>(`${pageId}/conversations`, {
    platform: 'instagram',
    // Only the fields verified to answer fast; participants come from the messages.
    fields: 'id,updated_time',
    limit: String(limit),
    access_token: pageToken,
  });
  return data.data || [];
}

/** The latest messages of one conversation, as Meta returns them (newest first). */
export async function getConversationMessages(
  conversationId: string,
  pageToken: string,
  limit = 30
): Promise<IgMessage[]> {
  const data = await graphGet<{ messages?: { data?: IgMessage[] } }>(conversationId, {
    fields: `messages.limit(${Math.max(1, Math.min(100, limit))}){id,created_time,from,to,message,story,attachments}`,
    access_token: pageToken,
  });
  return data.messages?.data || [];
}

/**
 * Send a plain DM to an Instagram user (by their IGSID) from the page inbox.
 * Same defensive parsing and retryable flag as the private replies: Meta only
 * accepts it within 24 hours of the user's last message.
 */
export async function sendInstagramMessage(
  recipientId: string,
  message: string,
  pageToken: string
): Promise<{ messageId: string; recipientId?: string }> {
  const res = await fetch(`${GRAPH_BASE}/me/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: message },
      messaging_type: 'RESPONSE',
      access_token: pageToken,
    }),
    cache: 'no-store',
  });

  const raw = await res.text();
  let data: any = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { /* not JSON */ }

  if (!res.ok || data?.error) {
    const e = data?.error;
    const detail = e ? `${e.message || 'error'}${e.code ? ` (code ${e.code}${e.error_subcode ? `/${e.error_subcode}` : ''})` : ''}` : (raw ? raw.slice(0, 200) : 'empty response');
    const error: any = new Error(`HTTP ${res.status}: ${detail}`);
    error.status = res.status;
    error.metaCode = e?.code;
    error.retryable = isRetryable(res.status, e?.code);
    throw error;
  }

  const messageId = data?.message_id || data?.id;
  if (!messageId) {
    const error: any = new Error(`HTTP ${res.status} with no message id: ${raw ? raw.slice(0, 200) : 'empty response'}`);
    error.status = res.status;
    error.retryable = true;
    throw error;
  }
  return { messageId, recipientId: data?.recipient_id };
}

/** Subscribe a page to webhook events (feed comments). Requires page token. */
export async function subscribePageWebhook(
  pageId: string,
  pageToken: string
): Promise<{ success?: boolean }> {
  return graphPost(`${pageId}/subscribed_apps`, {
    subscribed_fields: 'feed',
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
      fields: 'id,text,username,timestamp,like_count,replies{username}',
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

/** The IG business account's own username (used to recognise threads we already answered). */
export async function getInstagramUsername(igUserId: string, pageToken: string): Promise<string> {
  const data = await graphGet<{ username?: string }>(`${igUserId}`, {
    fields: 'username',
    access_token: pageToken,
  });
  return data.username || '';
}


/* ---------------------------------------------------------------------------
 * Post summary for the automations list: one batched Graph call per 50 ids
 * (`/?ids=a,b,c`) instead of one request per automation.
 * ------------------------------------------------------------------------- */
export interface PostInfo {
  id: string;
  permalink?: string;
  comments_count?: number | null;
  like_count?: number | null;
  text?: string;
  image?: string;
}

export async function getPostsInfo(
  ids: string[],
  pageToken: string,
  platform: 'facebook' | 'instagram'
): Promise<Record<string, PostInfo>> {
  const out: Record<string, PostInfo> = {};
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  for (let i = 0; i < uniq.length; i += 50) {
    const chunk = uniq.slice(i, i + 50);
    const fields =
      platform === 'instagram'
        ? 'id,permalink,comments_count,like_count,caption,thumbnail_url,media_url,media_type'
        : 'id,permalink_url,message,story,full_picture,comments.summary(true).limit(0),likes.summary(true).limit(0)';
    try {
      const data = await graphGet<Record<string, any>>('', { ids: chunk.join(','), fields, access_token: pageToken });
      for (const [id, m] of Object.entries(data)) {
        if (!m || typeof m !== 'object') continue;
        out[id] =
          platform === 'instagram'
            ? { id, permalink: m.permalink, comments_count: m.comments_count ?? null, like_count: m.like_count ?? null, text: m.caption || '', image: m.thumbnail_url || (m.media_type === 'IMAGE' ? m.media_url : undefined) }
            : { id, permalink: m.permalink_url, comments_count: m.comments?.summary?.total_count ?? null, like_count: m.likes?.summary?.total_count ?? null, text: m.message || m.story || '', image: m.full_picture };
      }
    } catch {
      // best effort: a failed batch leaves those automations without post info
    }
  }
  return out;
}


/** getPostsInfo through the post_cache table (10-minute freshness). Pass the app's sql tag. */
export async function getPostsInfoCached(
  db: any,
  ids: string[],
  pageToken: string,
  platform: 'facebook' | 'instagram',
  freshMs = 10 * 60 * 1000
): Promise<Record<string, PostInfo>> {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (!uniq.length) return {};
  const out: Record<string, PostInfo> = {};
  const rows = await db`SELECT post_id, payload, updated_at FROM post_cache WHERE post_id = ANY(${uniq})`;
  const now = Date.now();
  const stale: string[] = [];
  const seen = new Set<string>();
  for (const r of rows as any[]) {
    seen.add(r.post_id);
    const payload = typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload;
    out[r.post_id] = payload;
    if (now - new Date(r.updated_at).getTime() > freshMs) stale.push(r.post_id);
  }
  const missing = uniq.filter((id) => !seen.has(id));
  const toFetch = [...missing, ...stale];
  if (toFetch.length) {
    const fresh = await getPostsInfo(toFetch, pageToken, platform);
    for (const [id, info] of Object.entries(fresh)) {
      out[id] = info;
      db`INSERT INTO post_cache (post_id, payload, updated_at) VALUES (${id}, ${db.json(info)}, now())
         ON CONFLICT (post_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`.catch(() => {});
    }
  }
  return out;
}

/* ------------------------------------------------------------------------ */
/* Publishing                                                                 */
/* ------------------------------------------------------------------------ */

export type IgPublishKind = 'image' | 'video' | 'reel' | 'carousel' | 'story';

/**
 * Instagram publishing is two calls: create a container, then publish it.
 * Video and reel containers are processed asynchronously, so the container has
 * to report FINISHED before it can be published; we poll status_code with a
 * ceiling instead of waiting forever.
 *
 * Media must sit on a public HTTPS URL that Meta can fetch. Requires the
 * instagram_content_publish permission on the connected account.
 */
export async function createInstagramContainer(
  igUserId: string,
  pageToken: string,
  opts: { kind: IgPublishKind; imageUrl?: string; videoUrl?: string; caption?: string; children?: string[]; coverUrl?: string; isCarouselItem?: boolean }
): Promise<string> {
  const body: Record<string, string> = { access_token: pageToken };
  if (opts.caption) body.caption = opts.caption;
  if (opts.kind === 'carousel') {
    body.media_type = 'CAROUSEL';
    body.children = (opts.children || []).join(',');
  } else if (opts.kind === 'reel') {
    body.media_type = 'REELS';
    body.video_url = String(opts.videoUrl);
    if (opts.coverUrl) body.cover_url = opts.coverUrl;
  } else if (opts.kind === 'story') {
    body.media_type = 'STORIES';
    if (opts.videoUrl) body.video_url = opts.videoUrl; else body.image_url = String(opts.imageUrl);
  } else if (opts.kind === 'video') {
    body.media_type = 'VIDEO';
    body.video_url = String(opts.videoUrl);
  } else {
    body.image_url = String(opts.imageUrl);
  }
  if (opts.isCarouselItem) { body.is_carousel_item = 'true'; delete body.caption; }
  const res = await graphPost<{ id: string }>(`${igUserId}/media`, body);
  return res.id;
}

/** Wait until an Instagram container finishes processing (video and reel only). */
export async function waitForContainer(containerId: string, pageToken: string, tries = 20, delayMs = 3000): Promise<void> {
  for (let i = 0; i < tries; i++) {
    const s = await graphGet<{ status_code?: string; status?: string }>(containerId, { fields: 'status_code,status', access_token: pageToken });
    if (s.status_code === 'FINISHED') return;
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new Error(`Instagram media processing ${s.status_code}: ${s.status || ''}`.trim());
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error('Instagram media is still processing. Try publishing the container again in a minute.');
}

export async function publishInstagramContainer(igUserId: string, containerId: string, pageToken: string): Promise<{ id: string }> {
  return graphPost(`${igUserId}/media_publish`, { creation_id: containerId, access_token: pageToken });
}

/** Permalink of a freshly published item, for the tool result. */
export async function getMediaPermalink(mediaId: string, pageToken: string): Promise<string | null> {
  try {
    const d = await graphGet<{ permalink?: string }>(mediaId, { fields: 'permalink', access_token: pageToken });
    return d.permalink || null;
  } catch { return null; }
}

/**
 * Publish to a Facebook page: a photo when an image URL is given, otherwise a
 * text or link post. Requires pages_manage_posts on the page.
 */
export async function publishFacebookPost(
  pageId: string,
  pageToken: string,
  opts: { message?: string; imageUrl?: string; link?: string }
): Promise<{ id: string; permalink: string | null }> {
  let id: string;
  if (opts.imageUrl) {
    const body: Record<string, string> = { url: opts.imageUrl, access_token: pageToken };
    if (opts.message) body.caption = opts.message;
    const res = await graphPost<{ id: string; post_id?: string }>(`${pageId}/photos`, body);
    id = res.post_id || res.id;
  } else {
    const body: Record<string, string> = { message: String(opts.message || ''), access_token: pageToken };
    if (opts.link) body.link = opts.link;
    const res = await graphPost<{ id: string }>(`${pageId}/feed`, body);
    id = res.id;
  }
  let permalink: string | null = null;
  try {
    const d = await graphGet<{ permalink_url?: string }>(id, { fields: 'permalink_url', access_token: pageToken });
    permalink = d.permalink_url ? (d.permalink_url.startsWith('http') ? d.permalink_url : `https://www.facebook.com${d.permalink_url}`) : null;
  } catch { /* the post is live either way */ }
  return { id, permalink };
}

/* ------------------------------------------------------------------------ */
/* Post history                                                               */
/* ------------------------------------------------------------------------ */

export interface MediaInsight { reach?: number; impressions?: number; saved?: number; shares?: number; views?: number }

/**
 * Reach, saves and shares for one Instagram media item.
 *
 * Meta renamed and retired these metric names more than once, and asking for a
 * metric an account cannot serve fails the WHOLE call rather than that one
 * field. So the metrics are tried in descending order of richness and the
 * first set that answers wins; an account that serves none simply has no
 * insight row, which the recommendations treat as missing rather than zero.
 */
export async function getMediaInsights(mediaId: string, pageToken: string): Promise<MediaInsight | null> {
  const attempts = [
    'reach,saved,shares,views,total_interactions',
    'reach,saved,shares',
    'reach,impressions,saved',
    'reach',
  ];
  for (const metric of attempts) {
    try {
      const d = await graphGet<{ data?: { name: string; values?: { value: number }[] }[] }>(`${mediaId}/insights`, { metric, access_token: pageToken });
      const out: MediaInsight = {};
      for (const row of d.data || []) {
        const v = row.values?.[0]?.value;
        if (typeof v !== 'number') continue;
        if (row.name === 'reach') out.reach = v;
        else if (row.name === 'impressions') out.impressions = v;
        else if (row.name === 'saved') out.saved = v;
        else if (row.name === 'shares') out.shares = v;
        else if (row.name === 'views') out.views = v;
      }
      if (Object.keys(out).length) return out;
    } catch { /* try a narrower metric set */ }
  }
  return null;
}

/** Every media item on the account, paging past the 25 the list call returns. */
export async function listAllInstagramMedia(igUserId: string, pageToken: string, max = 200): Promise<InstagramMedia[]> {
  const out: InstagramMedia[] = [];
  let url: string | null = null;
  let params: Record<string, string> | null = {
    fields: 'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count',
    limit: '50',
    access_token: pageToken,
  };
  let path: string | null = `${igUserId}/media`;

  while (out.length < max) {
    const data: { data?: InstagramMedia[]; paging?: { next?: string } } = url
      ? await (async () => { const r = await fetch(url as string, { cache: 'no-store' }); const j = await r.json(); if (j.error) throw new Error(j.error.message); return j; })()
      : await graphGet(path as string, params as Record<string, string>);
    out.push(...(data.data || []));
    if (!data.paging?.next || !(data.data || []).length) break;
    url = data.paging.next; path = null; params = null;
  }
  return out.slice(0, max);
}

/** The account's follower count, the denominator for an engagement rate. */
export async function getInstagramFollowers(igUserId: string, pageToken: string): Promise<number | null> {
  try {
    const d = await graphGet<{ followers_count?: number }>(igUserId, { fields: 'followers_count', access_token: pageToken });
    return typeof d.followers_count === 'number' ? d.followers_count : null;
  } catch { return null; }
}
