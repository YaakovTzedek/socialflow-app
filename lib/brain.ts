import { sql, ensureSchema } from './db';

/**
 * Brain: what the account has actually learned from its own history.
 *
 * Every number here is counted from trigger_logs and automations, never
 * modelled or estimated, and every insight carries the figures it was derived
 * from so the user can check it against the tables on the same screen.
 * Insights only fire above a sample threshold, because a rule read off three
 * comments is noise dressed as advice.
 */

export type InsightKey =
  | 'bestAutomation' | 'gapAutomation' | 'bestKeyword' | 'bestPost'
  | 'peakHour' | 'failures' | 'linkLift' | 'growth';

export interface Insight { key: InsightKey; vars: Record<string, string | number>; tone: 'good' | 'warn' | 'info'; }

export interface BrainRow { id: string; label: string; sub?: string | null; permalink?: string | null; triggers: number; leads: number; rate: number; }

export interface BrainData {
  days: number;
  totals: { triggers: number; leads: number; replies: number; failed: number; deliveryRate: number };
  automations: BrainRow[];
  posts: BrainRow[];
  keywords: BrainRow[];
  byHour: { hour: number; triggers: number }[];
  daily: { day: string; triggers: number; leads: number }[];
  insights: Insight[];
  hasData: boolean;
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** Postgres rejects an unknown zone, so fall back rather than fail the page. */
async function safeZone(tz: string): Promise<string> {
  if (!/^[A-Za-z_]+\/[A-Za-z_+\-0-9]+$/.test(tz)) return 'UTC';
  try {
    await sql!`SELECT now() AT TIME ZONE ${tz}`;
    return tz;
  } catch { return 'UTC'; }
}

export async function getBrain(ownerId: string, days = 30, tz = 'UTC'): Promise<BrainData> {
  await ensureSchema();
  const zone = await safeZone(tz);
  // days === 0 asks for the whole history, not the last zero days.
  const since = days > 0 ? new Date(Date.now() - days * 86400000) : new Date(0);

  const [totals] = await sql!`
    SELECT count(*)::int AS triggers,
           count(*) FILTER (WHERE l.dm_status = 'sent')::int AS leads,
           count(*) FILTER (WHERE l.public_reply_status = 'sent')::int AS replies,
           count(*) FILTER (WHERE l.dm_status = 'failed')::int AS failed
    FROM trigger_logs l JOIN automations a ON a.id = l.automation_id
    WHERE a.owner_id = ${ownerId} AND l.created_at >= ${since}`;

  const autoRows = await sql!`
    SELECT a.id, a.name, a.platform, a.dm_link,
           count(l.id)::int AS triggers,
           count(l.id) FILTER (WHERE l.dm_status = 'sent')::int AS leads
    FROM automations a LEFT JOIN trigger_logs l ON l.automation_id = a.id AND l.created_at >= ${since}
    WHERE a.owner_id = ${ownerId}
    GROUP BY a.id, a.name, a.platform, a.dm_link
    HAVING count(l.id) > 0
    ORDER BY leads DESC, triggers DESC LIMIT 8`;

  const postRows = await sql!`
    SELECT l.post_id, l.platform,
           count(*)::int AS triggers,
           count(*) FILTER (WHERE l.dm_status = 'sent')::int AS leads,
           max(a.name) AS automation_name
    FROM trigger_logs l JOIN automations a ON a.id = l.automation_id
    WHERE a.owner_id = ${ownerId} AND l.created_at >= ${since} AND l.post_id IS NOT NULL
    GROUP BY l.post_id, l.platform
    ORDER BY leads DESC, triggers DESC LIMIT 8`;

  const kwRows = await sql!`
    SELECT lower(l.matched_keyword) AS keyword,
           count(*)::int AS triggers,
           count(*) FILTER (WHERE l.dm_status = 'sent')::int AS leads
    FROM trigger_logs l JOIN automations a ON a.id = l.automation_id
    WHERE a.owner_id = ${ownerId} AND l.created_at >= ${since}
      AND l.matched_keyword IS NOT NULL AND l.matched_keyword <> ''
    GROUP BY lower(l.matched_keyword)
    ORDER BY leads DESC, triggers DESC LIMIT 8`;

  const hourRows = await sql!`
    SELECT extract(hour FROM l.created_at AT TIME ZONE ${zone})::int AS hour, count(*)::int AS triggers
    FROM trigger_logs l JOIN automations a ON a.id = l.automation_id
    WHERE a.owner_id = ${ownerId} AND l.created_at >= ${since}
    GROUP BY 1 ORDER BY 1`;

  const dailyRows = await sql!`
    SELECT to_char(l.created_at AT TIME ZONE ${zone}, 'YYYY-MM-DD') AS day,
           count(*)::int AS triggers,
           count(*) FILTER (WHERE l.dm_status = 'sent')::int AS leads
    FROM trigger_logs l JOIN automations a ON a.id = l.automation_id
    WHERE a.owner_id = ${ownerId} AND l.created_at >= ${since}
    GROUP BY 1 ORDER BY 1`;

  // Link lift: automations that attach a link against those that do not.
  const [linkSplit] = await sql!`
    SELECT
      count(l.id) FILTER (WHERE a.dm_link IS NOT NULL AND a.dm_link <> '')::int AS with_total,
      count(l.id) FILTER (WHERE a.dm_link IS NOT NULL AND a.dm_link <> '' AND l.dm_status = 'sent')::int AS with_leads,
      count(l.id) FILTER (WHERE a.dm_link IS NULL OR a.dm_link = '')::int AS without_total,
      count(l.id) FILTER (WHERE (a.dm_link IS NULL OR a.dm_link = '') AND l.dm_status = 'sent')::int AS without_leads
    FROM trigger_logs l JOIN automations a ON a.id = l.automation_id
    WHERE a.owner_id = ${ownerId} AND l.created_at >= ${since}`;

  const [weeks] = await sql!`
    SELECT
      count(*) FILTER (WHERE l.created_at >= now() - interval '7 days')::int AS this_week,
      count(*) FILTER (WHERE l.created_at >= now() - interval '14 days' AND l.created_at < now() - interval '7 days')::int AS last_week
    FROM trigger_logs l JOIN automations a ON a.id = l.automation_id
    WHERE a.owner_id = ${ownerId}`;

  // Permalinks for the posts we are about to show, from the cache the app fills.
  const ids = (postRows as any[]).map((r) => r.post_id);
  const cache = ids.length ? await sql!`SELECT post_id, payload FROM post_cache WHERE post_id = ANY(${ids})` : [];
  const linkOf = new Map<string, string | null>();
  const captionOf = new Map<string, string | null>();
  for (const c of cache as any[]) {
    const p = typeof c.payload === 'string' ? JSON.parse(c.payload) : c.payload;
    linkOf.set(c.post_id, p?.permalink || p?.permalink_url || null);
    captionOf.set(c.post_id, (p?.caption || p?.message || '').slice(0, 90) || null);
  }

  const automations: BrainRow[] = (autoRows as any[]).map((r) => ({
    id: r.id, label: r.name, sub: r.platform, triggers: r.triggers, leads: r.leads, rate: pct(r.leads, r.triggers),
  }));
  const posts: BrainRow[] = (postRows as any[]).map((r) => ({
    id: r.post_id,
    label: captionOf.get(r.post_id) || r.automation_name || r.post_id,
    sub: r.platform,
    permalink: linkOf.get(r.post_id) || null,
    triggers: r.triggers, leads: r.leads, rate: pct(r.leads, r.triggers),
  }));
  const keywords: BrainRow[] = (kwRows as any[]).map((r) => ({
    id: r.keyword, label: r.keyword, triggers: r.triggers, leads: r.leads, rate: pct(r.leads, r.triggers),
  }));

  const t = { triggers: totals?.triggers ?? 0, leads: totals?.leads ?? 0, replies: totals?.replies ?? 0, failed: totals?.failed ?? 0 };
  const insights: Insight[] = [];

  if (automations.length && automations[0].leads >= 5) {
    insights.push({ key: 'bestAutomation', tone: 'good', vars: { name: automations[0].label, leads: automations[0].leads } });
  }
  const ranked = automations.filter((a) => a.triggers >= 10).sort((a, b) => b.rate - a.rate);
  if (ranked.length >= 2 && ranked[0].rate - ranked[ranked.length - 1].rate >= 20) {
    const best = ranked[0], worst = ranked[ranked.length - 1];
    insights.push({ key: 'gapAutomation', tone: 'info', vars: { best: best.label, bestRate: best.rate, worst: worst.label, worstRate: worst.rate } });
  }
  if (keywords.length && keywords[0].leads >= 5) {
    insights.push({ key: 'bestKeyword', tone: 'good', vars: { keyword: keywords[0].label, leads: keywords[0].leads } });
  }
  if (posts.length && posts[0].triggers >= 10) {
    insights.push({ key: 'bestPost', tone: 'good', vars: { post: posts[0].label, triggers: posts[0].triggers } });
  }
  const hours = (hourRows as any[]).map((r) => ({ hour: r.hour as number, triggers: r.triggers as number }));
  if (t.triggers >= 30 && hours.length) {
    const peak = hours.reduce((a, b) => (b.triggers > a.triggers ? b : a));
    if (peak.triggers >= t.triggers * 0.15) {
      insights.push({ key: 'peakHour', tone: 'info', vars: { from: `${String(peak.hour).padStart(2, '0')}:00`, to: `${String((peak.hour + 1) % 24).padStart(2, '0')}:00` } });
    }
  }
  if (t.failed >= 3 && pct(t.failed, t.triggers) >= 10) {
    insights.push({ key: 'failures', tone: 'warn', vars: { failed: t.failed, rate: pct(t.failed, t.triggers) } });
  }
  const ls = linkSplit as any;
  if (ls && ls.with_total >= 20 && ls.without_total >= 20) {
    const withRate = pct(ls.with_leads, ls.with_total), withoutRate = pct(ls.without_leads, ls.without_total);
    if (Math.abs(withRate - withoutRate) >= 10) insights.push({ key: 'linkLift', tone: 'info', vars: { withRate, withoutRate } });
  }
  const w = weeks as any;
  if (w && (w.this_week >= 10 || w.last_week >= 10)) {
    insights.push({ key: 'growth', tone: w.this_week >= w.last_week ? 'good' : 'warn', vars: { thisWeek: w.this_week, lastWeek: w.last_week } });
  }

  return {
    days,
    totals: { ...t, deliveryRate: pct(t.leads, t.triggers) },
    automations, posts, keywords,
    byHour: hours,
    daily: (dailyRows as any[]).map((r) => ({ day: r.day, triggers: r.triggers, leads: r.leads })),
    insights,
    hasData: t.triggers > 0,
  };
}

/* ------------------------------------------------------------------------ */
/* Cross-account learning                                                     */
/* ------------------------------------------------------------------------ */

/**
 * The segments a business can pick. Coarse on purpose: a bucket has to hold
 * enough accounts for its average to mean anything and for no single account
 * to be recognisable inside it.
 */
export const SEGMENTS = ['shop', 'coach', 'clinic', 'food', 'realestate', 'education', 'agency', 'creator', 'other'] as const;
export type Segment = typeof SEGMENTS[number];
export function isSegment(v: unknown): v is Segment { return typeof v === 'string' && (SEGMENTS as readonly string[]).includes(v); }

/** No benchmark is published for a bucket thinner than this. */
const MIN_OWNERS = 5;
const MIN_TRIGGERS = 200;
/** A keyword is only shown if this many different accounts use it. */
const MIN_KEYWORD_OWNERS = 3;

export interface SegmentBenchmark {
  segment: Segment;
  owners: number;
  deliveryRate: number;
  linkRate: number | null;
  noLinkRate: number | null;
  peakHour: number | null;
  topKeywords: string[];
  computedAt: string;
}

/**
 * Recompute the per-segment benchmarks. Runs on a schedule, never per request:
 * it reads across every account, so it must stay out of the request path and
 * its output must never be able to identify one of them. A segment is only
 * written when at least five accounts and two hundred matched comments sit
 * behind it, and a keyword only when three different accounts use it.
 */
export async function learnSegments(): Promise<{ segments: number }> {
  await ensureSchema();
  const since = new Date(Date.now() - 90 * 86400000);

  const rows = await sql!`
    SELECT p.segment,
           count(DISTINCT a.owner_id)::int AS owners,
           count(l.id)::int AS triggers,
           count(l.id) FILTER (WHERE l.dm_status = 'sent')::int AS leads,
           count(l.id) FILTER (WHERE a.dm_link IS NOT NULL AND a.dm_link <> '')::int AS with_total,
           count(l.id) FILTER (WHERE a.dm_link IS NOT NULL AND a.dm_link <> '' AND l.dm_status = 'sent')::int AS with_leads,
           count(l.id) FILTER (WHERE a.dm_link IS NULL OR a.dm_link = '')::int AS without_total,
           count(l.id) FILTER (WHERE (a.dm_link IS NULL OR a.dm_link = '') AND l.dm_status = 'sent')::int AS without_leads
    FROM owner_prefs p
    JOIN automations a ON a.owner_id = p.owner_id
    JOIN trigger_logs l ON l.automation_id = a.id AND l.created_at >= ${since}
    WHERE p.segment IS NOT NULL
    GROUP BY p.segment`;

  let written = 0;
  for (const r of rows as any[]) {
    if (r.owners < MIN_OWNERS || r.triggers < MIN_TRIGGERS) continue;

    const [peak] = await sql!`
      SELECT extract(hour FROM l.created_at)::int AS hour, count(*)::int AS n
      FROM owner_prefs p JOIN automations a ON a.owner_id = p.owner_id
      JOIN trigger_logs l ON l.automation_id = a.id AND l.created_at >= ${since}
      WHERE p.segment = ${r.segment}
      GROUP BY 1 ORDER BY n DESC LIMIT 1`;

    // What format actually earns comments in this field, across accounts.
    const [fmt] = await sql!`
      SELECT ps.media_type, count(*)::int AS n, round(avg(COALESCE(ps.comments,0))::numeric,1)::float AS avg_comments
      FROM owner_prefs p JOIN post_stats ps ON ps.owner_id = p.owner_id
      WHERE p.segment = ${r.segment} AND ps.media_type IS NOT NULL
      GROUP BY ps.media_type HAVING count(*) >= 20
      ORDER BY avg_comments DESC LIMIT 1`;

    const [med] = await sql!`
      SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(ps.comments,0))::float AS median
      FROM owner_prefs p JOIN post_stats ps ON ps.owner_id = p.owner_id
      WHERE p.segment = ${r.segment}`;

    const kw = await sql!`
      SELECT lower(l.matched_keyword) AS keyword,
             count(DISTINCT a.owner_id)::int AS owners,
             count(*) FILTER (WHERE l.dm_status = 'sent')::int AS leads
      FROM owner_prefs p JOIN automations a ON a.owner_id = p.owner_id
      JOIN trigger_logs l ON l.automation_id = a.id AND l.created_at >= ${since}
      WHERE p.segment = ${r.segment} AND l.matched_keyword IS NOT NULL AND l.matched_keyword <> ''
      GROUP BY 1 HAVING count(DISTINCT a.owner_id) >= ${MIN_KEYWORD_OWNERS}
      ORDER BY leads DESC LIMIT 6`;

    await sql!`
      INSERT INTO segment_stats (segment, owners, triggers, leads, delivery_rate, link_rate, no_link_rate, peak_hour,
        best_format, best_format_avg, median_comments, top_keywords, computed_at)
      VALUES (${r.segment}, ${r.owners}, ${r.triggers}, ${r.leads}, ${pct(r.leads, r.triggers)},
              ${r.with_total >= 50 ? pct(r.with_leads, r.with_total) : null},
              ${r.without_total >= 50 ? pct(r.without_leads, r.without_total) : null},
              ${peak?.hour ?? null},
              ${fmt?.media_type ?? null}, ${fmt?.avg_comments ?? null}, ${med?.median ?? null},
              ${sql!.json((kw as any[]).map((k) => k.keyword))}, now())
      ON CONFLICT (segment) DO UPDATE SET
        owners = EXCLUDED.owners, triggers = EXCLUDED.triggers, leads = EXCLUDED.leads,
        delivery_rate = EXCLUDED.delivery_rate, link_rate = EXCLUDED.link_rate,
        no_link_rate = EXCLUDED.no_link_rate, peak_hour = EXCLUDED.peak_hour,
        best_format = EXCLUDED.best_format, best_format_avg = EXCLUDED.best_format_avg,
        median_comments = EXCLUDED.median_comments,
        top_keywords = EXCLUDED.top_keywords, computed_at = now()`;
    written++;
  }
  return { segments: written };
}

export async function getSegment(ownerId: string): Promise<Segment | null> {
  await ensureSchema();
  const [row] = await sql!`SELECT segment FROM owner_prefs WHERE owner_id = ${ownerId}`;
  return isSegment(row?.segment) ? row.segment : null;
}

export async function setSegment(ownerId: string, segment: Segment): Promise<void> {
  await ensureSchema();
  await sql!`
    INSERT INTO owner_prefs (owner_id, segment) VALUES (${ownerId}, ${segment})
    ON CONFLICT (owner_id) DO UPDATE SET segment = EXCLUDED.segment, updated_at = now()`;
}

export async function getSegmentBenchmark(segment: Segment | null): Promise<SegmentBenchmark | null> {
  if (!segment) return null;
  await ensureSchema();
  const [row] = await sql!`SELECT * FROM segment_stats WHERE segment = ${segment}`;
  if (!row) return null;
  const raw = row.top_keywords;
  return {
    segment,
    owners: row.owners,
    deliveryRate: row.delivery_rate,
    linkRate: row.link_rate,
    noLinkRate: row.no_link_rate,
    peakHour: row.peak_hour,
    topKeywords: (typeof raw === 'string' ? JSON.parse(raw) : raw) || [],
    computedAt: row.computed_at,
  };
}
