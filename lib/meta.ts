/**
 * Meta Graph API helper functions.
 * All calls go directly to Facebook's Graph API — no database, no third-party backend.
 */

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export const META_APP_ID = process.env.META_APP_ID || '1414848844000934';
export const META_APP_SECRET = process.env.META_APP_SECRET || '';

/** Permissions we request for managing pages and replying to comments. */
export const SCOPES = [
  'public_profile',
  'pages_show_list',
  'pages_read_engagement',
  'pages_read_user_content',
  'pages_manage_engagement',
  'pages_manage_posts',
].join(',');

export interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  category?: string;
  tasks?: string[];
  picture?: { data?: { url?: string } };
  fan_count?: number;
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

/** List the pages the user manages (each includes a page-scoped access token). */
export async function listPages(userToken: string): Promise<FacebookPage[]> {
  const data = await graphGet<{ data: FacebookPage[] }>('me/accounts', {
    fields: 'id,name,access_token,category,tasks,fan_count,picture{url}',
    limit: '100',
    access_token: userToken,
  });
  return data.data || [];
}

/** List recent posts for a page (uses the page access token). */
export async function listPagePosts(
  pageId: string,
  pageToken: string
): Promise<FacebookPost[]> {
  const data = await graphGet<{ data: FacebookPost[] }>(`${pageId}/posts`, {
    fields:
      'id,message,story,created_time,permalink_url,full_picture,comments.summary(true).limit(0),likes.summary(true).limit(0)',
    limit: '25',
    access_token: pageToken,
  });
  return data.data || [];
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
