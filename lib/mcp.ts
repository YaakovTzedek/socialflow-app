/**
 * SocialFlow MCP server (Streamable HTTP, JSON responses).
 *
 * One endpoint, JSON-RPC 2.0 over POST, no SSE: every MCP client that speaks
 * Streamable HTTP (Claude Code, claude.ai custom connectors, ChatGPT developer
 * mode, Cursor) accepts a plain `application/json` reply. Auth is an API key
 * the user mints on /mcp, sent as `Authorization: Bearer <key>` or embedded in
 * the URL (/api/mcp/<key>) for clients that cannot set headers.
 *
 * Tools read and write the same tables the app uses, so an automation created
 * from a chat shows up in the dashboard and is picked up by the poller on its
 * next pass. The page access token comes from page_tokens (stored when the user
 * created an automation in the app), never from the chat.
 */
import { randomUUID } from 'crypto';
import { sql, ensureSchema } from './db';
import { listInstagramMedia, listPagePosts, getPostsInfoCached, createInstagramContainer, waitForContainer, publishInstagramContainer, getMediaPermalink, publishFacebookPost, type IgPublishKind } from './meta';
import { getEntitlement } from './entitlements';
import { getBrain, getSegment, getSegmentBenchmark } from './brain';
import { getMessages, negotiate, isLocale, fmt, type Locale, type Messages } from './i18n';

export const PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = { name: 'socialflow', version: '1.0.0' };

type Json = Record<string, unknown>;
type Rpc = { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: Json };

export interface McpUser { owner_id: string; key: string; locale: Locale }

/** Resolve an API key to its owner (null when unknown). Touches last_used_at. */
export async function resolveApiKey(key: string | null | undefined, acceptLanguage?: string | null): Promise<McpUser | null> {
  if (!key || !sql) return null;
  await ensureSchema();
  const [row] = await sql`SELECT k.key, k.owner_id, k.locale, p.locale AS owner_locale FROM api_keys k LEFT JOIN owner_prefs p ON p.owner_id = k.owner_id WHERE k.key = ${key} AND k.revoked_at IS NULL LIMIT 1`;
  if (!row) return null;
  sql`UPDATE api_keys SET last_used_at = now() WHERE key = ${key}`.catch(() => {});
  // Language: the key's own (minted on /mcp or via OAuth in that locale) > the owner's app language > Accept-Language > English.
  const locale: Locale = isLocale(row.locale) ? row.locale : isLocale(row.owner_locale) ? row.owner_locale : negotiate(acceptLanguage);
  return { owner_id: row.owner_id as string, key: row.key as string, locale };
}

/* ------------------------------------------------------------------------ */
/* Tool definitions (JSON Schema for inputs)                                  */
/* ------------------------------------------------------------------------ */

function toolsFor(m: Messages) {
  const T = m.server.tools; const A = m.server.toolArgs;
  return [
    { name: 'list_pages', description: T.list_pages, inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'list_posts', description: T.list_posts, inputSchema: { type: 'object', properties: { page_id: { type: 'string', description: A.page_id }, platform: { type: 'string', enum: ['instagram', 'facebook'], description: A.platform }, limit: { type: 'integer', minimum: 1, maximum: 25, default: 10 } }, required: ['page_id', 'platform'], additionalProperties: false } },
    { name: 'list_automations', description: T.list_automations, inputSchema: { type: 'object', properties: { status: { type: 'string', enum: ['active', 'paused', 'all'], default: 'all' } }, additionalProperties: false } },
    { name: 'get_automation', description: T.get_automation, inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false } },
    { name: 'create_automation', description: T.create_automation, inputSchema: { type: 'object', properties: {
        page_id: { type: 'string', description: A.page_id }, platform: { type: 'string', enum: ['instagram', 'facebook'] }, post_id: { type: 'string', description: A.post_id }, all_posts: { type: 'boolean', default: false },
        name: { type: 'string', description: A.name }, keywords: { type: 'array', items: { type: 'string' }, description: A.keywords }, match_type: { type: 'string', enum: ['contains', 'exact'], default: 'contains' },
        public_replies: { type: 'array', items: { type: 'string' }, description: A.public_replies }, dm_message: { type: 'string', description: A.dm_message }, dm_link: { type: 'string', description: A.dm_link },
        once_per_user: { type: 'boolean', default: true }, status: { type: 'string', enum: ['active', 'paused'], default: 'active' } }, required: ['page_id', 'platform'], additionalProperties: false } },
    { name: 'update_automation', description: T.update_automation, inputSchema: { type: 'object', properties: { id: { type: 'string' }, status: { type: 'string', enum: ['active', 'paused'] }, name: { type: 'string' }, keywords: { type: 'array', items: { type: 'string' } }, match_type: { type: 'string', enum: ['contains', 'exact'] }, public_reply_enabled: { type: 'boolean' }, public_replies: { type: 'array', items: { type: 'string' } }, dm_enabled: { type: 'boolean' }, dm_message: { type: 'string' }, dm_link: { type: 'string' }, once_per_user: { type: 'boolean' } }, required: ['id'], additionalProperties: false } },
    { name: 'delete_automation', description: T.delete_automation, inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false } },
    { name: 'get_activity', description: T.get_activity, inputSchema: { type: 'object', properties: { automation_id: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 }, since_hours: { type: 'integer', minimum: 1, maximum: 720, description: A.since_hours } }, additionalProperties: false } },
    { name: 'get_report', description: T.get_report, inputSchema: { type: 'object', properties: { period: { type: 'string', enum: ['today', '7d', '30d'], default: '7d' } }, additionalProperties: false } },
    { name: 'get_insights', description: T.get_insights, inputSchema: { type: 'object', properties: {
        days: { type: 'integer', enum: [7, 30, 90], default: 30, description: A.days },
      }, additionalProperties: false } },
    { name: 'publish_post', description: T.publish_post, inputSchema: { type: 'object', properties: {
        page_id: { type: 'string', description: A.page_id },
        platform: { type: 'string', enum: ['instagram', 'facebook'], description: A.platform },
        media_type: { type: 'string', enum: ['image', 'carousel', 'video', 'reel', 'story', 'text', 'link'], description: A.media_type },
        caption: { type: 'string', description: A.caption },
        image_url: { type: 'string', description: A.image_url },
        image_urls: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 10, description: A.image_urls },
        video_url: { type: 'string', description: A.video_url },
        cover_url: { type: 'string', description: A.cover_url },
        link: { type: 'string', description: A.link },
      }, required: ['page_id', 'platform', 'media_type'], additionalProperties: false } },
  ];
}

/* ------------------------------------------------------------------------ */
/* Tool implementations                                                       */
/* ------------------------------------------------------------------------ */

async function pageToken(owner: string, pageId: string) {
  const [row] = await sql!`SELECT access_token, ig_id, page_name FROM page_tokens WHERE page_id = ${pageId} AND owner_id = ${owner} LIMIT 1`;
  return row as { access_token: string; ig_id: string | null; page_name: string | null } | undefined;
}

async function toolListPages(owner: string, m: Messages) {
  const [cache] = await sql!`SELECT payload FROM pages_cache WHERE owner_id = ${owner}`;
  const tokens = await sql!`SELECT page_id, page_name, ig_id FROM page_tokens WHERE owner_id = ${owner}`;
  const raw = cache?.payload; const pages: any[] = (typeof raw === 'string' ? JSON.parse(raw) : raw) || [];
  if (!pages.length && !tokens.length) {
    return { pages: [], note: m.server.mcpNoPages };
  }
  const known = new Set(tokens.map((t: any) => t.page_id));
  return {
    pages: pages.map((p) => ({ page_id: p.id, name: p.name, ig_id: p.instagram?.id || null, ig_username: p.instagram?.username || null, ready_for_automations: known.has(p.id) })),
    note: m.server.mcpReadyNote,
  };
}

async function toolListPosts(owner: string, a: Json, m: Messages) {
  const t = await pageToken(owner, String(a.page_id));
  if (!t) throw new Error(m.server.mcpPageNotReady);
  const limit = Math.min(25, Math.max(1, Number(a.limit) || 10));
  if (a.platform === 'instagram') {
    if (!t.ig_id) throw new Error(m.server.mcpNoIg);
    const media = await listInstagramMedia(t.ig_id, t.access_token);
    return { posts: media.slice(0, limit).map((m) => ({ post_id: m.id, type: m.media_type, permalink: m.permalink, caption: (m.caption || '').slice(0, 200), comments: m.comments_count ?? null, likes: m.like_count ?? null, published_at: m.timestamp })) };
  }
  const posts = await listPagePosts(String(a.page_id), t.access_token);
  return { posts: posts.slice(0, limit).map((p) => ({ post_id: p.id, permalink: p.permalink_url, text: (p.message || p.story || '').slice(0, 200), comments: p.comments?.summary?.total_count ?? null, likes: p.likes?.summary?.total_count ?? null, published_at: p.created_time })) };
}

async function statsFor(ids: string[]) {
  if (!ids.length) return new Map<string, any>();
  const rows = await sql!`
    SELECT automation_id, count(*)::int AS triggers,
           count(*) FILTER (WHERE dm_status = 'sent')::int AS dms_sent,
           count(*) FILTER (WHERE public_reply_status = 'sent')::int AS replies_sent,
           count(*) FILTER (WHERE dm_status = 'failed' OR public_reply_status = 'failed')::int AS failed,
           max(created_at) AS last_at
    FROM trigger_logs WHERE automation_id = ANY(${ids}) GROUP BY automation_id`;
  return new Map<string, any>(rows.map((r: any) => [r.automation_id, r]));
}

function shape(a: any, st?: any) {
  return {
    id: a.id, name: a.name, status: a.status, platform: a.platform, page_id: a.page_id, page_name: a.page_name,
    post_id: a.post_id, post_scope: a.post_scope, keywords: a.keywords, match_type: a.match_type,
    public_reply_enabled: a.public_reply_enabled, public_replies: a.public_replies,
    dm_enabled: a.dm_enabled, dm_message: a.dm_message, dm_link: a.dm_link, once_per_user: a.once_per_user,
    created_at: a.created_at,
    stats: st || { triggers: 0, dms_sent: 0, replies_sent: 0, failed: 0, last_at: null },
  };
}

async function toolListAutomations(owner: string, a: Json) {
  const status = String(a.status || 'all');
  const rows = status === 'all'
    ? await sql!`SELECT * FROM automations WHERE owner_id = ${owner} ORDER BY created_at DESC`
    : await sql!`SELECT * FROM automations WHERE owner_id = ${owner} AND status = ${status} ORDER BY created_at DESC`;
  const st = await statsFor(rows.map((r: any) => r.id));
  // permalinks, best effort, one batched call per page+platform
  const posts: Record<string, any> = {};
  const groups = new Map<string, { page_id: string; platform: 'facebook' | 'instagram'; ids: string[] }>();
  for (const r of rows as any[]) if (r.post_id) { const k = `${r.page_id}:${r.platform}`; const g = groups.get(k) || { page_id: r.page_id as string, platform: r.platform as 'facebook' | 'instagram', ids: [] as string[] }; g.ids.push(r.post_id as string); groups.set(k, g); }
  await Promise.all(Array.from(groups.values()).map(async (g) => { const t = await pageToken(owner, g.page_id); if (t) Object.assign(posts, await getPostsInfoCached(sql, g.ids, t.access_token, g.platform)); }));
  return { count: rows.length, automations: (rows as any[]).map((r) => ({ ...shape(r, st.get(r.id)), post_permalink: r.post_id ? posts[r.post_id]?.permalink || null : null, post_comments: r.post_id ? posts[r.post_id]?.comments_count ?? null : null })) };
}

async function toolGetAutomation(owner: string, a: Json) {
  const [row] = await sql!`SELECT * FROM automations WHERE id = ${String(a.id)} AND owner_id = ${owner}`;
  if (!row) throw new Error('not_found');
  const st = await statsFor([row.id as string]);
  const logs = await sql!`SELECT created_at, commenter_name, comment_text, matched_keyword, public_reply_status, dm_status, error_message FROM trigger_logs WHERE automation_id = ${row.id as string} ORDER BY created_at DESC LIMIT 20`;
  return { automation: shape(row, st.get(row.id as string)), recent_activity: logs };
}

async function toolCreateAutomation(owner: string, a: Json, m: Messages) {
  const pageId = String(a.page_id || '');
  const platform = a.platform === 'facebook' ? 'facebook' : 'instagram';
  const allPosts = a.all_posts === true;
  const postId = allPosts ? null : String(a.post_id || '');
  if (!pageId) throw new Error(m.server.mcpPageIdRequired);
  if (!allPosts && !postId) throw new Error(m.server.mcpPostIdRequired);
  const t = await pageToken(owner, pageId);
  if (!t) throw new Error(m.server.mcpPageNotReady);
  const keywords = Array.isArray(a.keywords) ? (a.keywords as unknown[]).map((k) => String(k).trim()).filter(Boolean) : [];
  const replies = Array.isArray(a.public_replies) ? (a.public_replies as unknown[]).map((k) => String(k).trim()).filter(Boolean) : [];
  const dmMessage = a.dm_message ? String(a.dm_message) : null;
  const dmLink = a.dm_link ? String(a.dm_link) : null;
  const name = String(a.name || (keywords[0] ? `${keywords[0]} · ${t.page_name || pageId}` : `${m.common.anyComment} · ${t.page_name || pageId}`));
  const id = randomUUID();
  await sql!`
    INSERT INTO automations (id, owner_id, name, platform, page_id, page_name, ig_id, post_id, post_scope, keywords, match_type,
      public_reply_enabled, public_replies, dm_enabled, dm_message, dm_link, once_per_user, status)
    VALUES (${id}, ${owner}, ${name}, ${platform}, ${pageId}, ${t.page_name}, ${t.ig_id}, ${postId}, ${allPosts ? 'all_posts' : 'specific_post'},
      ${keywords}, ${a.match_type === 'exact' ? 'exact' : 'contains'}, ${replies.length > 0}, ${replies},
      ${!!(dmMessage || dmLink)}, ${dmMessage}, ${dmLink}, ${a.once_per_user !== false}, ${a.status === 'paused' ? 'paused' : 'active'})`;
  const [row] = await sql!`SELECT * FROM automations WHERE id = ${id}`;
  return { created: true, automation: shape(row), note: m.server.mcpCreatedNote };
}

async function toolUpdateAutomation(owner: string, a: Json, m: Messages) {
  const id = String(a.id || '');
  const EDITABLE = ['name', 'keywords', 'match_type', 'public_reply_enabled', 'public_replies', 'dm_enabled', 'dm_message', 'dm_link', 'once_per_user', 'status'];
  const patch: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in a) patch[k] = a[k];
  if ('keywords' in patch) patch.keywords = Array.isArray(patch.keywords) ? (patch.keywords as unknown[]).map((k) => String(k).trim()).filter(Boolean) : [];
  if ('public_replies' in patch) patch.public_replies = Array.isArray(patch.public_replies) ? (patch.public_replies as unknown[]).map((k) => String(k).trim()).filter(Boolean) : [];
  if (!Object.keys(patch).length) throw new Error(m.server.mcpNothingToUpdate);
  await sql!`UPDATE automations SET ${sql!(patch as any, ...Object.keys(patch))} WHERE id = ${id} AND owner_id = ${owner}`;
  const [row] = await sql!`SELECT * FROM automations WHERE id = ${id} AND owner_id = ${owner}`;
  if (!row) throw new Error('not_found');
  return { updated: true, automation: shape(row) };
}

async function toolDeleteAutomation(owner: string, a: Json) {
  const res = await sql!`DELETE FROM automations WHERE id = ${String(a.id || '')} AND owner_id = ${owner}`;
  return { deleted: res.count > 0 };
}

async function toolGetActivity(owner: string, a: Json) {
  const limit = Math.min(200, Math.max(1, Number(a.limit) || 50));
  const sinceHours = Number(a.since_hours) || 0;
  const since = sinceHours ? new Date(Date.now() - sinceHours * 3600 * 1000) : new Date(0);
  const autoId = a.automation_id ? String(a.automation_id) : null;
  const rows = autoId
    ? await sql!`SELECT l.created_at, a.name AS automation, l.platform, l.commenter_name, l.comment_text, l.matched_keyword, l.public_reply_status, l.dm_status, l.error_message
                 FROM trigger_logs l JOIN automations a ON a.id = l.automation_id
                 WHERE a.owner_id = ${owner} AND l.automation_id = ${autoId} AND l.created_at >= ${since} ORDER BY l.created_at DESC LIMIT ${limit}`
    : await sql!`SELECT l.created_at, a.name AS automation, l.platform, l.commenter_name, l.comment_text, l.matched_keyword, l.public_reply_status, l.dm_status, l.error_message
                 FROM trigger_logs l JOIN automations a ON a.id = l.automation_id
                 WHERE a.owner_id = ${owner} AND l.created_at >= ${since} ORDER BY l.created_at DESC LIMIT ${limit}`;
  return { count: rows.length, activity: rows };
}

async function toolGetReport(owner: string, a: Json) {
  const period = String(a.period || '7d');
  const now = new Date();
  const start = period === 'today' ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : new Date(now.getTime() - (period === '30d' ? 30 : 7) * 86400000);
  const [tot] = await sql!`
    SELECT count(*)::int AS handled,
           count(*) FILTER (WHERE l.dm_status = 'sent')::int AS dms_sent,
           count(*) FILTER (WHERE l.public_reply_status = 'sent')::int AS replies_sent,
           count(*) FILTER (WHERE l.dm_status = 'failed' OR l.public_reply_status = 'failed')::int AS failed,
           count(DISTINCT l.commenter_id)::int AS unique_people
    FROM trigger_logs l JOIN automations a ON a.id = l.automation_id
    WHERE a.owner_id = ${owner} AND l.created_at >= ${start}`;
  const top = await sql!`
    SELECT a.name, a.id, count(*)::int AS handled, count(*) FILTER (WHERE l.dm_status = 'sent')::int AS dms_sent
    FROM trigger_logs l JOIN automations a ON a.id = l.automation_id
    WHERE a.owner_id = ${owner} AND l.created_at >= ${start}
    GROUP BY a.id, a.name ORDER BY handled DESC LIMIT 10`;
  const [counts] = await sql!`SELECT count(*)::int AS total, count(*) FILTER (WHERE status = 'active')::int AS active FROM automations WHERE owner_id = ${owner}`;
  return { period, since: start.toISOString(), totals: tot, automations: counts, top_automations: top };
}

/**
 * Publish a post. Instagram goes through the container → publish flow (video
 * and reel containers are processed asynchronously, so we wait for FINISHED);
 * Facebook posts a photo, a text update or a link. Gated on the plan's
 * `publishing` capability so the tool is inert on anything under Pro even if
 * the transport ever lets a lower plan reach MCP.
 */
async function toolPublishPost(owner: string, a: Json, m: Messages) {
  const ent = await getEntitlement(owner);
  if (!ent.plan.limits.publishing) throw new Error(m.server.mcpPublishNeedsPro);

  const t = await pageToken(owner, String(a.page_id));
  if (!t) throw new Error(m.server.mcpPageNotReady);

  const kind = String(a.media_type || '');
  const caption = a.caption ? String(a.caption) : undefined;

  if (a.platform === 'facebook') {
    if (kind === 'video' || kind === 'reel' || kind === 'carousel' || kind === 'story') throw new Error(m.server.mcpPublishNoFbMedia);
    const imageUrl = a.image_url ? String(a.image_url) : undefined;
    if (!imageUrl && !caption && !a.link) throw new Error(m.server.mcpPublishNeedsText);
    const res = await publishFacebookPost(String(a.page_id), t.access_token, { message: caption, imageUrl, link: a.link ? String(a.link) : undefined });
    return { published: true, platform: 'facebook', post_id: res.id, permalink: res.permalink, note: m.server.mcpPublishedNote };
  }

  if (!t.ig_id) throw new Error(m.server.mcpNoIg);
  const ig = t.ig_id;
  let containerId: string;

  if (kind === 'carousel') {
    const urls = Array.isArray(a.image_urls) ? (a.image_urls as unknown[]).map(String) : [];
    if (urls.length < 2 || urls.length > 10) throw new Error(m.server.mcpPublishNeedsCarousel);
    const children: string[] = [];
    for (const url of urls) children.push(await createInstagramContainer(ig, t.access_token, { kind: 'image', imageUrl: url, isCarouselItem: true }));
    containerId = await createInstagramContainer(ig, t.access_token, { kind: 'carousel', children, caption });
  } else if (kind === 'video' || kind === 'reel') {
    if (!a.video_url) throw new Error(m.server.mcpPublishNeedsVideo);
    containerId = await createInstagramContainer(ig, t.access_token, { kind: kind as IgPublishKind, videoUrl: String(a.video_url), coverUrl: a.cover_url ? String(a.cover_url) : undefined, caption });
    await waitForContainer(containerId, t.access_token);
  } else if (kind === 'story') {
    if (!a.image_url && !a.video_url) throw new Error(m.server.mcpPublishNeedsImage);
    containerId = await createInstagramContainer(ig, t.access_token, { kind: 'story', imageUrl: a.image_url ? String(a.image_url) : undefined, videoUrl: a.video_url ? String(a.video_url) : undefined });
    if (a.video_url) await waitForContainer(containerId, t.access_token);
  } else {
    if (!a.image_url) throw new Error(m.server.mcpPublishNeedsImage);
    containerId = await createInstagramContainer(ig, t.access_token, { kind: 'image', imageUrl: String(a.image_url), caption });
  }

  const published = await publishInstagramContainer(ig, containerId, t.access_token);
  const permalink = await getMediaPermalink(published.id, t.access_token);
  return { published: true, platform: 'instagram', post_id: published.id, permalink, note: m.server.mcpPublishedNote };
}

/**
 * The Brain screen, as a tool. Same counts the owner sees in the app, plus the
 * rendered insight sentences, so an assistant asked "what worked best" answers
 * from measured history instead of guessing from raw rows.
 */
async function toolGetInsights(owner: string, a: Json, m: Messages) {
  const days = [7, 30, 90].includes(Number(a.days)) ? Number(a.days) : 30;
  const brain = await getBrain(owner, days, 'UTC');
  const segment = await getSegment(owner);
  const benchmark = await getSegmentBenchmark(segment);
  const templates = m.brain.insights as Record<string, string>;

  return {
    period_days: days,
    totals: brain.totals,
    top_automations: brain.automations.map((r) => ({ name: r.label, triggers: r.triggers, leads: r.leads, comment_to_lead_percent: r.rate })),
    top_posts: brain.posts.map((r) => ({ post: r.label, permalink: r.permalink, triggers: r.triggers, leads: r.leads, comment_to_lead_percent: r.rate })),
    top_keywords: brain.keywords.map((r) => ({ keyword: r.label, triggers: r.triggers, leads: r.leads, comment_to_lead_percent: r.rate })),
    comments_by_hour_utc: brain.byHour,
    insights: brain.insights.map((i) => fmt(templates[i.key] || '', i.vars as Record<string, string | number>)),
    segment: segment
      ? benchmark
        ? { name: segment, accounts: benchmark.owners, comment_to_lead_percent: benchmark.deliveryRate, top_keywords: benchmark.topKeywords, peak_hour: benchmark.peakHour, note: m.brain.benchPrivacy }
        : { name: segment, note: m.brain.segmentThin }
      : null,
    note: m.server.mcpInsightsNote,
  };
}

async function callTool(owner: string, name: string, args: Json, m: Messages) {
  switch (name) {
    case 'list_pages': return toolListPages(owner, m);
    case 'list_posts': return toolListPosts(owner, args, m);
    case 'list_automations': return toolListAutomations(owner, args);
    case 'get_automation': return toolGetAutomation(owner, args);
    case 'create_automation': return toolCreateAutomation(owner, args, m);
    case 'update_automation': return toolUpdateAutomation(owner, args, m);
    case 'delete_automation': return toolDeleteAutomation(owner, args);
    case 'get_activity': return toolGetActivity(owner, args);
    case 'get_report': return toolGetReport(owner, args);
    case 'get_insights': return toolGetInsights(owner, args, m);
    case 'publish_post': return toolPublishPost(owner, args, m);
    default: throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32602 });
  }
}

/* ------------------------------------------------------------------------ */
/* JSON-RPC dispatch                                                          */
/* ------------------------------------------------------------------------ */

function ok(id: Rpc['id'], result: unknown) { return { jsonrpc: '2.0', id: id ?? null, result }; }
function err(id: Rpc['id'], code: number, message: string) { return { jsonrpc: '2.0', id: id ?? null, error: { code, message } }; }

/** Handle one JSON-RPC message (or a batch). Returns null for notifications. */
export async function handleRpc(user: McpUser, body: unknown): Promise<unknown | null> {
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handleOne(user, m)))).filter((x) => x !== null);
    return out.length ? out : null;
  }
  return handleOne(user, body);
}

async function handleOne(user: McpUser, msg: unknown): Promise<unknown | null> {
  const m = (msg || {}) as Rpc;
  const L = getMessages(user.locale);
  if (!m.method) return err(m.id, -32600, 'Invalid Request');
  const isNotification = m.id === undefined;
  try {
    switch (m.method) {
      case 'initialize':
        return ok(m.id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: L.server.mcpInstructions,
        });
      case 'notifications/initialized':
      case 'notifications/cancelled':
      case 'notifications/progress':
        return null;
      case 'ping':
        return ok(m.id, {});
      case 'tools/list':
        return ok(m.id, { tools: toolsFor(L) });
      case 'tools/call': {
        const name = String(m.params?.name || '');
        const args = ((m.params?.arguments as Json) || {}) as Json;
        try {
          await ensureSchema();
          const result = await callTool(user.owner_id, name, args, L);
          return ok(m.id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], structuredContent: result, isError: false });
        } catch (e: any) {
          if (e?.code === -32602) return err(m.id, -32602, e.message);
          return ok(m.id, { content: [{ type: 'text', text: `${L.server.mcpErrorPrefix}${e?.message || 'unknown'}` }], isError: true });
        }
      }
      case 'resources/list': return ok(m.id, { resources: [] });
      case 'prompts/list': return ok(m.id, { prompts: [] });
      default:
        return isNotification ? null : err(m.id, -32601, `Method not found: ${m.method}`);
    }
  } catch (e: any) {
    return err(m.id, -32603, e?.message || 'Internal error');
  }
}
