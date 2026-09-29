/**
 * Customer data for the owner's admin area: one row per account with plan,
 * pages, automations and activity, and a per-account detail with a timeline.
 *
 * There is no users table from before 29.9.2026: an account is an owner_id
 * (the Facebook user id) that appears in any of the tables below. Names and
 * login times are only known from app_users, which starts filling on the next
 * login or app visit, so older accounts show their page names until then.
 */
import { sql, ensureSchema } from './db';
import { PLAN_CATALOG } from './plans';
import { isOwnerId } from './owner';

export interface CustomerRow {
  owner_id: string;
  name: string | null;
  email: string | null;
  page_names: string[];
  locale: string | null;
  segment: string | null;
  signup_at: string | null;
  signup_exact: boolean;
  last_seen_at: string | null;
  last_login_at: string | null;
  login_count: number;
  last_activity_at: string | null;
  plan_id: string;
  plan_name: string;
  plan_source: 'override' | 'subscription' | 'free';
  plan_expires_at: string | null;
  pages: number;
  ig_accounts: number;
  automations: number;
  automations_active: number;
  mcp_keys: number;
  mcp_last_used_at: string | null;
  oauth_connections: number;
  affiliate_code: string | null;
  c7: number; c30: number; r7: number; r30: number; dm7: number; dm30: number;
  leads7: number; leads30: number; fail7: number; fail30: number; token7: number;
  total_triggers: number;
  last_trigger_at: string | null;
  health: { code: string; label: string; tone: 'good' | 'warn' | 'bad' | 'muted' }[];
  is_owner: boolean;
}

// Meta errors that mean the page token no longer works (revoked, password
// change, app removed), as opposed to a single message that failed.
const TOKEN_PATTERNS = ['%access token%', '%OAuthException%', '%session has been invalidated%', '%Error validating%', '%(#190)%', '%code 190%'];

function health(r: any): CustomerRow['health'] {
  const out: CustomerRow['health'] = [];
  if (r.pages === 0) out.push({ code: 'no_pages', label: 'אין עמוד מחובר', tone: 'bad' });
  else if (r.automations === 0) out.push({ code: 'no_automation', label: 'מחובר בלי אוטומציה', tone: 'warn' });
  else if (r.automations_active === 0) out.push({ code: 'all_paused', label: 'כל האוטומציות מושהות', tone: 'warn' });
  if (r.token7 > 0) out.push({ code: 'token', label: 'בעיית טוקן מול מטא', tone: 'bad' });
  else if (r.fail7 > 0) out.push({ code: 'errors', label: `${r.fail7} כשלים בשבוע`, tone: 'bad' });
  if (r.automations_active > 0 && r.c30 === 0) out.push({ code: 'quiet', label: 'פעיל, בלי תגובות 30 יום', tone: 'muted' });
  if (!out.length) out.push({ code: 'ok', label: 'תקין', tone: 'good' });
  return out;
}

export async function listCustomers(onlyId?: string): Promise<CustomerRow[]> {
  await ensureSchema();
  const one = onlyId ?? null;
  const tokenLike = TOKEN_PATTERNS;
  const rows = await sql!`
    WITH ids AS (
      SELECT owner_id FROM app_users
      UNION SELECT owner_id FROM page_tokens
      UNION SELECT owner_id FROM automations
      UNION SELECT owner_id FROM api_keys
      UNION SELECT owner_id FROM subscriptions
      UNION SELECT owner_id FROM plan_overrides
      UNION SELECT owner_id FROM owner_prefs
      UNION SELECT owner_id FROM pages_cache
      UNION SELECT owner_id FROM affiliate_referrals
    ),
    pg AS (
      SELECT owner_id, count(*)::int AS pages, count(ig_id)::int AS ig_accounts,
             array_agg(page_name ORDER BY page_name) FILTER (WHERE page_name IS NOT NULL) AS page_names,
             max(updated_at) AS pages_updated
      FROM page_tokens GROUP BY 1
    ),
    au AS (
      SELECT owner_id, count(*)::int AS automations,
             count(*) FILTER (WHERE status = 'active')::int AS automations_active,
             min(created_at) AS first_auto, max(created_at) AS last_auto
      FROM automations GROUP BY 1
    ),
    act AS (
      SELECT a.owner_id,
        count(*) FILTER (WHERE l.created_at > now() - interval '7 days')::int AS c7,
        count(*) FILTER (WHERE l.created_at > now() - interval '30 days')::int AS c30,
        count(*) FILTER (WHERE l.public_reply_status = 'sent' AND l.created_at > now() - interval '7 days')::int AS r7,
        count(*) FILTER (WHERE l.public_reply_status = 'sent' AND l.created_at > now() - interval '30 days')::int AS r30,
        count(*) FILTER (WHERE l.dm_status = 'sent' AND l.created_at > now() - interval '7 days')::int AS dm7,
        count(*) FILTER (WHERE l.dm_status = 'sent' AND l.created_at > now() - interval '30 days')::int AS dm30,
        count(DISTINCT l.commenter_id) FILTER (WHERE l.dm_status = 'sent' AND l.created_at > now() - interval '7 days')::int AS leads7,
        count(DISTINCT l.commenter_id) FILTER (WHERE l.dm_status = 'sent' AND l.created_at > now() - interval '30 days')::int AS leads30,
        count(*) FILTER (WHERE l.dm_status = 'failed' AND l.created_at > now() - interval '7 days')::int AS fail7,
        count(*) FILTER (WHERE l.dm_status = 'failed' AND l.created_at > now() - interval '30 days')::int AS fail30,
        count(*) FILTER (WHERE l.created_at > now() - interval '7 days' AND l.error_message ILIKE ANY (${tokenLike}::text[]))::int AS token7,
        count(*)::int AS total_triggers,
        max(l.created_at) AS last_trigger_at
      FROM trigger_logs l JOIN automations a ON a.id = l.automation_id
      GROUP BY 1
    ),
    ov AS (
      SELECT owner_id, plan_id, expires_at FROM plan_overrides
      WHERE expires_at IS NULL OR expires_at > now()
    ),
    sub AS (
      SELECT DISTINCT ON (owner_id) owner_id, plan_id, current_period_end, payer_name, payer_email, created_at
      FROM subscriptions
      WHERE status IN ('trialing', 'active') OR (status = 'canceled' AND current_period_end > now())
      ORDER BY owner_id, (status IN ('trialing', 'active')) DESC, created_at DESC
    ),
    payer AS (
      SELECT DISTINCT ON (owner_id) owner_id, payer_name, payer_email, created_at AS first_sub
      FROM subscriptions ORDER BY owner_id, created_at DESC
    ),
    firstsub AS (SELECT owner_id, min(created_at) AS first_sub FROM subscriptions GROUP BY 1),
    keys AS (
      SELECT owner_id, count(*) FILTER (WHERE revoked_at IS NULL)::int AS mcp_keys,
             max(last_used_at) AS mcp_last_used_at, min(created_at) AS first_key
      FROM api_keys GROUP BY 1
    )
    SELECT i.owner_id,
      u.name, u.first_login_at, u.last_login_at, u.last_seen_at, COALESCE(u.login_count, 0) AS login_count,
      pr.locale, pr.segment,
      COALESCE(pg.pages, 0) AS pages, COALESCE(pg.ig_accounts, 0) AS ig_accounts,
      COALESCE(pg.page_names, '{}') AS page_names, pg.pages_updated,
      COALESCE(au.automations, 0) AS automations, COALESCE(au.automations_active, 0) AS automations_active,
      au.first_auto, au.last_auto,
      COALESCE(act.c7, 0) AS c7, COALESCE(act.c30, 0) AS c30, COALESCE(act.r7, 0) AS r7, COALESCE(act.r30, 0) AS r30,
      COALESCE(act.dm7, 0) AS dm7, COALESCE(act.dm30, 0) AS dm30, COALESCE(act.leads7, 0) AS leads7, COALESCE(act.leads30, 0) AS leads30,
      COALESCE(act.fail7, 0) AS fail7, COALESCE(act.fail30, 0) AS fail30, COALESCE(act.token7, 0) AS token7,
      COALESCE(act.total_triggers, 0) AS total_triggers, act.last_trigger_at,
      ov.plan_id AS ov_plan, ov.expires_at AS ov_expires,
      sub.plan_id AS sub_plan, sub.current_period_end AS sub_end,
      payer.payer_name, payer.payer_email,
      COALESCE(keys.mcp_keys, 0) AS mcp_keys, keys.mcp_last_used_at,
      ar.code AS affiliate_code, ar.first_seen_at AS aff_first,
      pc.updated_at AS pages_cache_at,
      LEAST(u.first_login_at, au.first_auto, keys.first_key, firstsub.first_sub, ar.first_seen_at) AS signup_at,
      GREATEST(u.last_seen_at, u.last_login_at, act.last_trigger_at, au.last_auto, keys.mcp_last_used_at, pc.updated_at, pg.pages_updated) AS last_activity_at
    FROM ids i
    LEFT JOIN app_users u ON u.owner_id = i.owner_id
    LEFT JOIN owner_prefs pr ON pr.owner_id = i.owner_id
    LEFT JOIN pg ON pg.owner_id = i.owner_id
    LEFT JOIN au ON au.owner_id = i.owner_id
    LEFT JOIN act ON act.owner_id = i.owner_id
    LEFT JOIN ov ON ov.owner_id = i.owner_id
    LEFT JOIN sub ON sub.owner_id = i.owner_id
    LEFT JOIN payer ON payer.owner_id = i.owner_id
    LEFT JOIN firstsub ON firstsub.owner_id = i.owner_id
    LEFT JOIN keys ON keys.owner_id = i.owner_id
    LEFT JOIN affiliate_referrals ar ON ar.owner_id = i.owner_id
    LEFT JOIN pages_cache pc ON pc.owner_id = i.owner_id
    WHERE (${one}::text IS NULL OR i.owner_id = ${one})
    ORDER BY last_activity_at DESC NULLS LAST`;

  // OAuth connections (Claude / ChatGPT "Sign in with SocialFlow") live in a
  // table created on first use by lib/oauth.ts, so it may not exist yet.
  const oauth = new Map<string, number>();
  try {
    const o = await sql!`SELECT owner_id, count(*)::int AS n FROM oauth_refresh WHERE revoked_at IS NULL GROUP BY 1`;
    for (const r of o) oauth.set(r.owner_id, r.n);
  } catch { /* no oauth table yet */ }

  return rows.map((r: any): CustomerRow => {
    const planId: string = r.ov_plan || r.sub_plan || 'free';
    const catalog = (PLAN_CATALOG as Record<string, { name: string }>)[planId];
    const iso = (d: any) => (d ? new Date(d).toISOString() : null);
    return {
      owner_id: r.owner_id,
      name: r.name || r.payer_name || null,
      email: r.payer_email || null,
      page_names: r.page_names || [],
      locale: r.locale || null,
      segment: r.segment || null,
      signup_at: iso(r.signup_at),
      signup_exact: !!r.first_login_at && iso(r.first_login_at) === iso(r.signup_at),
      last_seen_at: iso(r.last_seen_at),
      last_login_at: iso(r.last_login_at),
      login_count: r.login_count,
      last_activity_at: iso(r.last_activity_at),
      plan_id: planId,
      plan_name: catalog?.name || planId,
      plan_source: r.ov_plan ? 'override' : r.sub_plan ? 'subscription' : 'free',
      plan_expires_at: iso(r.ov_plan ? r.ov_expires : r.sub_end),
      pages: r.pages, ig_accounts: r.ig_accounts,
      automations: r.automations, automations_active: r.automations_active,
      mcp_keys: r.mcp_keys, mcp_last_used_at: iso(r.mcp_last_used_at),
      oauth_connections: oauth.get(r.owner_id) || 0,
      affiliate_code: r.affiliate_code || null,
      c7: r.c7, c30: r.c30, r7: r.r7, r30: r.r30, dm7: r.dm7, dm30: r.dm30,
      leads7: r.leads7, leads30: r.leads30, fail7: r.fail7, fail30: r.fail30, token7: r.token7,
      total_triggers: r.total_triggers,
      last_trigger_at: iso(r.last_trigger_at),
      health: health(r),
      is_owner: isOwnerId(r.owner_id),
    };
  });
}

export interface TimelineItem { at: string; kind: string; title: string; detail?: string | null; tone?: 'good' | 'warn' | 'bad' | 'muted' }

const PLATFORM: Record<string, string> = { facebook: 'פייסבוק', instagram: 'אינסטגרם' };
const REASON: Record<string, string> = { exit: 'יציאה מהבאנר', logout: 'התנתקות', login: 'התחברות מחדש', switched: 'מעבר ללקוח אחר' };
const ACTION: Record<string, string> = {
  automation_create: 'יצירת אוטומציה', automation_update: 'עריכה, הפעלה או השהיה של אוטומציה', automation_delete: 'מחיקת אוטומציה',
  billing_cancel: 'ביטול מנוי', billing_subscribe: 'רכישת מנוי', brain_update: 'עדכון Brain',
  facebook_comment_reply: 'תגובה בפייסבוק', facebook_comment: 'תגובה בפייסבוק', instagram_comment_reply: 'תגובה באינסטגרם',
  instagram_comment: 'תגובה באינסטגרם', instagram_dm_send: 'שליחת הודעה פרטית', webhook_subscribe: 'רישום וובהוק',
  mcp_key_create: 'יצירת מפתח MCP', mcp_key_revoke: 'ביטול מפתח MCP', oauth_approve: 'אישור חיבור OAuth', owner_claim: 'הענקת מסלול לבעלים',
};

function duration(sec: unknown): string {
  const s = Number(sec) || 0;
  if (s < 60) return `${s} שניות`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} דקות` : `${Math.floor(m / 60)} שעות ו-${m % 60} דקות`;
}

function eventItem(e: any, names: Map<string, string>): TimelineItem {
  const d = (typeof e.detail === 'string' ? JSON.parse(e.detail) : e.detail) || {};
  const at = new Date(e.created_at).toISOString();
  const actor = e.actor_id && e.actor_id !== e.owner_id ? (names.get(e.actor_id) || e.actor_id) : null;
  switch (e.kind) {
    case 'login': return { at, kind: e.kind, title: 'התחבר עם פייסבוק', tone: 'muted' };
    case 'automation_created': return { at, kind: e.kind, title: `יצר אוטומציה "${d.name ?? ''}"`, detail: [d.page, PLATFORM[d.platform] || d.platform, d.status === 'active' ? 'פעילה' : d.status].filter(Boolean).join(' · '), tone: 'good' };
    case 'automation_updated': {
      const what = d.status === 'active' ? 'הפעיל' : d.status === 'paused' ? 'השהה' : 'ערך';
      return { at, kind: e.kind, title: `${what} את האוטומציה "${d.name ?? ''}"`, detail: Array.isArray(d.fields) ? `שדות: ${d.fields.join(', ')}` : null, tone: d.status === 'paused' ? 'warn' : 'muted' };
    }
    case 'automation_deleted': return { at, kind: e.kind, title: `מחק את האוטומציה "${d.name ?? ''}"`, detail: d.page || null, tone: 'warn' };
    case 'impersonation_start': return { at, kind: e.kind, title: `${actor || 'הבעלים'} נכנס לצפייה כלקוח`, tone: 'muted' };
    case 'impersonation_stop': return { at, kind: e.kind, title: `${actor || 'הבעלים'} יצא ממצב הצפייה`, detail: `${REASON[d.reason] || d.reason || ''}, אחרי ${duration(d.seconds)}`, tone: 'muted' };
    case 'impersonation_blocked': return { at, kind: e.kind, title: 'פעולה נחסמה במצב צפייה', detail: ACTION[d.action] || d.action, tone: 'warn' };
    default: return { at, kind: e.kind, title: e.kind, detail: JSON.stringify(d), tone: 'muted' };
  }
}

/** Display names for a set of owner ids (for "who impersonated whom"). */
export async function namesFor(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (!uniq.length) return out;
  const rows = await sql!`
    SELECT i.id AS owner_id,
      COALESCE((SELECT name FROM app_users WHERE owner_id = i.id),
               (SELECT page_name FROM page_tokens WHERE owner_id = i.id AND page_name IS NOT NULL ORDER BY page_name LIMIT 1)) AS name
    FROM unnest(${uniq}::text[]) AS i(id)`;
  for (const r of rows) if (r.name) out.set(r.owner_id, r.name);
  return out;
}

export async function impersonationLog(limit = 100) {
  await ensureSchema();
  const rows = await sql!`
    SELECT id, owner_id, actor_id, kind, detail, created_at FROM audit_events
    WHERE kind IN ('impersonation_start', 'impersonation_stop', 'impersonation_blocked')
    ORDER BY created_at DESC LIMIT ${limit}`;
  const names = await namesFor(rows.flatMap((r: any) => [r.owner_id, r.actor_id]));
  return rows.map((r: any) => {
    const d = (typeof r.detail === 'string' ? JSON.parse(r.detail) : r.detail) || {};
    return {
      id: Number(r.id), kind: r.kind as string, at: new Date(r.created_at).toISOString(),
      owner_id: r.owner_id as string, owner_name: names.get(r.owner_id) || null,
      actor_id: r.actor_id as string | null, actor_name: r.actor_id ? names.get(r.actor_id) || null : null,
      detail: r.kind === 'impersonation_stop'
        ? `${REASON[d.reason] || d.reason || ''}, אחרי ${duration(d.seconds)}`
        : r.kind === 'impersonation_blocked' ? (ACTION[d.action] || d.action || '') : '',
    };
  });
}

export async function customerDetail(ownerId: string) {
  const [summary] = await listCustomers(ownerId);
  if (!summary) return null;

  const safe = async <T,>(p: Promise<T>, fallback: T): Promise<T> => { try { return await p; } catch { return fallback; } };

  const [automations, pages, pagesCache, keys, oauthRows, subs, invoices, overrides, referral, events, daily, errors] = await Promise.all([
    sql!`
      SELECT a.id, a.name, a.platform, a.page_name, a.post_scope, a.keywords, a.status, a.dm_enabled, a.public_reply_enabled,
             a.trigger_count, a.created_at,
             count(l.id) FILTER (WHERE l.created_at > now() - interval '7 days')::int AS c7,
             count(l.id) FILTER (WHERE l.created_at > now() - interval '30 days')::int AS c30,
             count(l.id) FILTER (WHERE l.dm_status = 'sent' AND l.created_at > now() - interval '30 days')::int AS dm30,
             count(l.id) FILTER (WHERE l.dm_status = 'failed' AND l.created_at > now() - interval '30 days')::int AS fail30,
             count(DISTINCT l.commenter_id) FILTER (WHERE l.dm_status = 'sent')::int AS leads,
             max(l.created_at) AS last_trigger_at
      FROM automations a LEFT JOIN trigger_logs l ON l.automation_id = a.id
      WHERE a.owner_id = ${ownerId}
      GROUP BY a.id ORDER BY a.status = 'active' DESC, a.created_at DESC`,
    sql!`SELECT page_id, page_name, ig_id, updated_at FROM page_tokens WHERE owner_id = ${ownerId} ORDER BY page_name`,
    sql!`SELECT payload, updated_at FROM pages_cache WHERE owner_id = ${ownerId}`,
    sql!`SELECT key, label, created_at, last_used_at, revoked_at FROM api_keys WHERE owner_id = ${ownerId} ORDER BY created_at DESC`,
    safe(sql!`SELECT r.created_at, r.revoked_at, c.client_name FROM oauth_refresh r LEFT JOIN oauth_clients c ON c.client_id = r.client_id WHERE r.owner_id = ${ownerId} ORDER BY r.created_at DESC`, [] as any),
    sql!`SELECT id, plan_id, interval, status, trial_ends_at, current_period_end, payer_name, payer_email, amount_agorot, currency, created_at, canceled_at FROM subscriptions WHERE owner_id = ${ownerId} ORDER BY created_at DESC`,
    sql!`SELECT id, amount_agorot, currency, status, pdf_url, created_at FROM invoices WHERE owner_id = ${ownerId} ORDER BY created_at DESC`,
    sql!`SELECT plan_id, note, created_at, expires_at FROM plan_overrides WHERE owner_id = ${ownerId}`,
    sql!`SELECT code, first_seen_at FROM affiliate_referrals WHERE owner_id = ${ownerId}`,
    sql!`SELECT id, owner_id, actor_id, kind, detail, created_at FROM audit_events WHERE owner_id = ${ownerId} ORDER BY created_at DESC LIMIT 300`,
    sql!`
      SELECT date_trunc('day', l.created_at) AS day, count(*)::int AS n,
             count(*) FILTER (WHERE l.public_reply_status = 'sent')::int AS replies,
             count(*) FILTER (WHERE l.dm_status = 'sent')::int AS dms,
             count(*) FILTER (WHERE l.dm_status = 'failed')::int AS failed
      FROM trigger_logs l JOIN automations a ON a.id = l.automation_id
      WHERE a.owner_id = ${ownerId} AND l.created_at > now() - interval '90 days'
      GROUP BY 1 ORDER BY 1 DESC`,
    sql!`
      SELECT l.error_message, count(*)::int AS n, max(l.created_at) AS last_at, min(a.name) AS automation
      FROM trigger_logs l JOIN automations a ON a.id = l.automation_id
      WHERE a.owner_id = ${ownerId} AND l.error_message IS NOT NULL AND l.error_message <> ''
        AND l.created_at > now() - interval '90 days'
      GROUP BY 1 ORDER BY last_at DESC LIMIT 20`,
  ]);

  const names = await namesFor(events.map((e: any) => e.actor_id));
  const tl: TimelineItem[] = [];
  const iso = (d: any) => new Date(d).toISOString();
  const [u] = await sql!`SELECT first_login_at FROM app_users WHERE owner_id = ${ownerId}`;
  if (u?.first_login_at) tl.push({ at: iso(u.first_login_at), kind: 'signup', title: 'נרשם (התחברות ראשונה)', tone: 'good' });
  else if (summary.signup_at) tl.push({ at: summary.signup_at, kind: 'signup', title: 'הפעולה הראשונה שנרשמה בחשבון', detail: 'לפני שנשמרו זמני התחברות, לכן זה הערכה', tone: 'muted' });

  const auditedCreates = new Set<string>();
  for (const e of events) {
    const d = (typeof e.detail === 'string' ? JSON.parse(e.detail) : e.detail) || {};
    if (e.kind === 'automation_created' && d.id) auditedCreates.add(d.id);
    tl.push(eventItem(e, names));
  }
  for (const a of automations) {
    if (auditedCreates.has(a.id)) continue;
    tl.push({ at: iso(a.created_at), kind: 'automation_created', title: `יצר אוטומציה "${a.name}"`, detail: [a.page_name, PLATFORM[a.platform] || a.platform].filter(Boolean).join(' · '), tone: 'good' });
  }
  for (const p of pages) tl.push({ at: iso(p.updated_at), kind: 'page', title: `עמוד "${p.page_name || p.page_id}" חובר או רוענן`, detail: p.ig_id ? 'כולל חשבון אינסטגרם עסקי' : null, tone: 'muted' });
  for (const k of keys) {
    tl.push({ at: iso(k.created_at), kind: 'mcp_key', title: 'יצר מפתח MCP', detail: k.label, tone: 'good' });
    if (k.revoked_at) tl.push({ at: iso(k.revoked_at), kind: 'mcp_key', title: 'ביטל מפתח MCP', detail: k.label, tone: 'warn' });
  }
  for (const o of oauthRows as any[]) {
    tl.push({ at: iso(o.created_at), kind: 'oauth', title: `חיבר את ${o.client_name || 'לקוח MCP'} בהתחברות OAuth`, tone: 'good' });
    if (o.revoked_at) tl.push({ at: iso(o.revoked_at), kind: 'oauth', title: `ניתק את ${o.client_name || 'לקוח MCP'}`, tone: 'warn' });
  }
  for (const s of subs) {
    tl.push({ at: iso(s.created_at), kind: 'billing', title: `${s.status === 'trialing' || s.trial_ends_at ? 'התחיל תקופת ניסיון' : 'נרשם למנוי'} ${s.plan_id} (${s.interval === 'year' ? 'שנתי' : 'חודשי'})`, detail: `${(s.amount_agorot / 100).toLocaleString('he-IL')} ${s.currency}`, tone: 'good' });
    if (s.canceled_at) tl.push({ at: iso(s.canceled_at), kind: 'billing', title: `ביטל את המנוי ${s.plan_id}`, tone: 'warn' });
  }
  for (const i of invoices) tl.push({ at: iso(i.created_at), kind: 'billing', title: 'חשבונית', detail: `${(i.amount_agorot / 100).toLocaleString('he-IL')} ${i.currency} · ${i.status}`, tone: 'muted' });
  for (const o of overrides) tl.push({ at: iso(o.created_at), kind: 'billing', title: `הוענק מסלול ${o.plan_id}`, detail: [o.note, o.expires_at ? `עד ${new Date(o.expires_at).toLocaleDateString('he-IL')}` : 'ללא תפוגה'].filter(Boolean).join(' · '), tone: 'good' });
  for (const r of referral) tl.push({ at: iso(r.first_seen_at), kind: 'affiliate', title: `הגיע דרך השותף ${r.code}`, tone: 'muted' });
  for (const d of daily) {
    tl.push({
      at: iso(d.day), kind: 'activity',
      title: `${d.n} תגובות טופלו`,
      detail: `${d.replies} תגובות ציבוריות · ${d.dms} הודעות פרטיות${d.failed ? ` · ${d.failed} כשלים` : ''}`,
      tone: d.failed ? 'warn' : 'muted',
    });
  }
  for (const e of errors) tl.push({ at: iso(e.last_at), kind: 'error', title: `שגיאה (${e.n} פעמים)`, detail: `${e.error_message}${e.automation ? ` · ${e.automation}` : ''}`, tone: 'bad' });
  tl.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  const cached = pagesCache[0] ? (typeof pagesCache[0].payload === 'string' ? JSON.parse(pagesCache[0].payload) : pagesCache[0].payload) : [];
  const byId = new Map<string, any>((Array.isArray(cached) ? cached : []).map((p: any) => [p.id, p]));

  return {
    summary,
    timeline: tl.slice(0, 400),
    automations: automations.map((a: any) => ({ ...a, created_at: iso(a.created_at), last_trigger_at: a.last_trigger_at ? iso(a.last_trigger_at) : null })),
    pages: pages.map((p: any) => {
      const c = byId.get(p.page_id);
      return {
        page_id: p.page_id, name: p.page_name, updated_at: iso(p.updated_at), picture: c?.picture || null,
        fans: c?.fan_count ?? null, ig_id: p.ig_id, ig_username: c?.instagram?.username || null, ig_followers: c?.instagram?.followers ?? null,
      };
    }),
    keys: keys.map((k: any) => ({ masked: `${String(k.key).slice(0, 6)}…${String(k.key).slice(-4)}`, label: k.label, created_at: iso(k.created_at), last_used_at: k.last_used_at ? iso(k.last_used_at) : null, revoked_at: k.revoked_at ? iso(k.revoked_at) : null })),
    oauth: (oauthRows as any[]).map((o) => ({ client: o.client_name, created_at: iso(o.created_at), revoked_at: o.revoked_at ? iso(o.revoked_at) : null })),
    subscriptions: subs,
    invoices,
    overrides,
  };
}
