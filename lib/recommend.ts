import { sql, ensureSchema } from './db';

/**
 * What to publish next, derived from the account's own history.
 *
 * Every recommendation carries the numbers it was computed from, and none is
 * emitted below its sample threshold. That restraint is the point: advice read
 * off three posts is noise wearing the costume of insight, and a tool that
 * says "post more reels" on no evidence teaches the user to ignore it.
 *
 * Where the account is too new to say anything, the segment average answers
 * instead, and the recommendation says so.
 */

export type RecKey =
  | 'bestFormat' | 'bestHour' | 'bestDay' | 'captionLength' | 'cadence'
  | 'missedAutomation' | 'hotPost' | 'repeatTopic' | 'segmentFormat' | 'segmentHour'
  | 'firstAutomation' | 'connectMore';

export interface Recommendation {
  key: RecKey;
  /** Sorted descending: what to act on first. */
  weight: number;
  tone: 'do' | 'try' | 'fix';
  vars: Record<string, string | number>;
  /** The post this points at, when it points at one. */
  permalink?: string | null;
}

const MIN_POSTS_PER_FORMAT = 4;
const MIN_POSTS_FOR_TIMING = 8;
const MIN_POSTS_FOR_LENGTH = 10;

const FORMAT_LABEL: Record<string, string> = {
  REELS: 'reel', VIDEO: 'video', CAROUSEL_ALBUM: 'carousel', IMAGE: 'image', POST: 'post',
};

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

export async function getRecommendations(ownerId: string, segment: string | null, tz = 'UTC'): Promise<Recommendation[]> {
  await ensureSchema();
  const recs: Recommendation[] = [];

  const [totals] = await sql!`
    SELECT count(*)::int AS posts, max(published_at) AS last_post, max(followers) AS followers
    FROM post_stats WHERE owner_id = ${ownerId}`;
  const posts = totals?.posts ?? 0;

  // Nothing ingested yet: the only useful advice is about the setup itself.
  if (posts === 0) {
    const [autos] = await sql!`SELECT count(*)::int AS n FROM automations WHERE owner_id = ${ownerId} AND status = 'active'`;
    if ((autos?.n ?? 0) === 0) recs.push({ key: 'firstAutomation', weight: 100, tone: 'do', vars: {} });
    return recs;
  }

  /* ── Which format earns the most comments per post ───────────────────── */
  const formats = await sql!`
    SELECT media_type, count(*)::int AS n,
           round(avg(COALESCE(comments, 0))::numeric, 1)::float AS avg_comments,
           round(avg(COALESCE(likes, 0))::numeric, 1)::float AS avg_likes,
           round(avg(COALESCE(reach, 0))::numeric, 0)::float AS avg_reach
    FROM post_stats WHERE owner_id = ${ownerId} AND media_type IS NOT NULL
    GROUP BY media_type HAVING count(*) >= ${MIN_POSTS_PER_FORMAT}
    ORDER BY avg_comments DESC`;
  const fRows = formats as any[];
  if (fRows.length >= 2) {
    const best = fRows[0], worst = fRows[fRows.length - 1];
    if (best.avg_comments >= worst.avg_comments * 1.4 && best.avg_comments >= 3) {
      recs.push({
        key: 'bestFormat', weight: 90, tone: 'do',
        vars: {
          format: FORMAT_LABEL[best.media_type] || String(best.media_type).toLowerCase(),
          avg: best.avg_comments, n: best.n,
          other: FORMAT_LABEL[worst.media_type] || String(worst.media_type).toLowerCase(),
          otherAvg: worst.avg_comments,
        },
      });
    }
  }

  /* ── When their audience actually shows up ───────────────────────────── */
  if (posts >= MIN_POSTS_FOR_TIMING) {
    const hours = await sql!`
      SELECT extract(hour FROM published_at AT TIME ZONE ${tz})::int AS hour,
             count(*)::int AS n,
             round(avg(COALESCE(comments, 0) + COALESCE(likes, 0) * 0.1)::numeric, 1)::float AS score
      FROM post_stats WHERE owner_id = ${ownerId} AND published_at IS NOT NULL
      GROUP BY 1 HAVING count(*) >= 2 ORDER BY score DESC LIMIT 1`;
    const h = (hours as any[])[0];
    if (h) recs.push({ key: 'bestHour', weight: 70, tone: 'try', vars: { from: `${String(h.hour).padStart(2, '0')}:00`, n: h.n, score: h.score } });

    const days = await sql!`
      SELECT extract(dow FROM published_at AT TIME ZONE ${tz})::int AS dow,
             count(*)::int AS n,
             round(avg(COALESCE(comments, 0))::numeric, 1)::float AS avg_comments
      FROM post_stats WHERE owner_id = ${ownerId} AND published_at IS NOT NULL
      GROUP BY 1 HAVING count(*) >= 2 ORDER BY avg_comments DESC LIMIT 1`;
    const d = (days as any[])[0];
    if (d && d.avg_comments >= 3) recs.push({ key: 'bestDay', weight: 60, tone: 'try', vars: { dow: d.dow, avg: d.avg_comments } });
  }

  /* ── Caption length, split at the median ─────────────────────────────── */
  if (posts >= MIN_POSTS_FOR_LENGTH) {
    const [len] = await sql!`
      WITH m AS (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY length(COALESCE(caption, ''))) AS mid FROM post_stats WHERE owner_id = ${ownerId})
      SELECT (SELECT round(mid)::int FROM m) AS mid,
             round(avg(COALESCE(comments,0)) FILTER (WHERE length(COALESCE(caption,'')) >= (SELECT mid FROM m))::numeric, 1)::float AS long_avg,
             round(avg(COALESCE(comments,0)) FILTER (WHERE length(COALESCE(caption,'')) <  (SELECT mid FROM m))::numeric, 1)::float AS short_avg
      FROM post_stats WHERE owner_id = ${ownerId}`;
    if (len && len.long_avg != null && len.short_avg != null && Math.max(len.long_avg, len.short_avg) >= 3) {
      const longer = len.long_avg > len.short_avg;
      const hi = longer ? len.long_avg : len.short_avg, lo = longer ? len.short_avg : len.long_avg;
      if (hi >= lo * 1.4) recs.push({ key: 'captionLength', weight: 45, tone: 'try', vars: { which: longer ? 'long' : 'short', mid: len.mid, hi, lo } });
    }
  }

  /* ── The biggest miss: a post that drew comments and had no automation ─ */
  const missed = await sql!`
    SELECT s.post_id, s.permalink, s.comments, s.caption, s.published_at
    FROM post_stats s
    WHERE s.owner_id = ${ownerId} AND COALESCE(s.comments, 0) >= 10
      AND s.published_at > now() - interval '120 days'
      AND NOT EXISTS (
        SELECT 1 FROM automations a
        WHERE a.owner_id = ${ownerId} AND a.status = 'active'
          AND (a.post_id = s.post_id OR a.post_scope = 'all_posts'))
    ORDER BY s.comments DESC LIMIT 1`;
  const miss = (missed as any[])[0];
  if (miss) {
    recs.push({
      key: 'missedAutomation', weight: 100, tone: 'fix',
      permalink: miss.permalink,
      vars: { comments: miss.comments, caption: (miss.caption || '').replace(/\s+/g, ' ').slice(0, 60) },
    });
  }

  /* ── A post still collecting comments right now ──────────────────────── */
  const hot = await sql!`
    SELECT post_id, permalink, comments, caption, published_at
    FROM post_stats
    WHERE owner_id = ${ownerId} AND published_at > now() - interval '7 days' AND COALESCE(comments, 0) >= 5
    ORDER BY comments DESC LIMIT 1`;
  const h2 = (hot as any[])[0];
  if (h2) {
    recs.push({
      key: 'hotPost', weight: 95, tone: 'do', permalink: h2.permalink,
      vars: { comments: h2.comments, caption: (h2.caption || '').replace(/\s+/g, ' ').slice(0, 60) },
    });
  }

  /* ── Posting rhythm ──────────────────────────────────────────────────── */
  const [rhythm] = await sql!`
    SELECT count(*)::int AS n,
           round(extract(epoch FROM (max(published_at) - min(published_at))) / 86400.0)::int AS span_days
    FROM post_stats WHERE owner_id = ${ownerId} AND published_at > now() - interval '90 days'`;
  if (rhythm && rhythm.n >= 5 && rhythm.span_days > 0) {
    const perWeek = Math.round((rhythm.n / rhythm.span_days) * 7 * 10) / 10;
    const daysSince = totals?.last_post ? Math.floor((Date.now() - new Date(totals.last_post).getTime()) / 86400000) : null;
    if (daysSince !== null && daysSince >= 7) {
      recs.push({ key: 'cadence', weight: 80, tone: 'fix', vars: { days: daysSince, perWeek } });
    }
  }

  /* ── What the top posts were about ───────────────────────────────────── */
  const top = await sql!`
    SELECT caption, comments, permalink FROM post_stats
    WHERE owner_id = ${ownerId} AND COALESCE(comments, 0) > 0 AND caption <> ''
    ORDER BY comments DESC LIMIT 3`;
  const topRows = top as any[];
  if (topRows.length === 3 && topRows[0].comments >= 8) {
    recs.push({
      key: 'repeatTopic', weight: 55, tone: 'try', permalink: topRows[0].permalink,
      vars: { caption: (topRows[0].caption || '').replace(/\s+/g, ' ').slice(0, 70), comments: topRows[0].comments },
    });
  }

  /* ── What works for accounts in the same field ───────────────────────── */
  if (segment) {
    const [seg] = await sql!`SELECT best_format, best_format_avg, peak_hour, owners FROM segment_stats WHERE segment = ${segment}`;
    if (seg?.best_format && seg.owners >= 5) {
      recs.push({ key: 'segmentFormat', weight: 40, tone: 'try', vars: { format: FORMAT_LABEL[seg.best_format] || seg.best_format, avg: seg.best_format_avg, owners: seg.owners } });
    }
    if (seg?.peak_hour != null && seg.owners >= 5) {
      recs.push({ key: 'segmentHour', weight: 35, tone: 'try', vars: { from: `${String(seg.peak_hour).padStart(2, '0')}:00`, owners: seg.owners } });
    }
  }

  /* ── One connected account and plenty of posts: connect the other one ── */
  const [accounts] = await sql!`SELECT count(DISTINCT page_id)::int AS n FROM page_tokens WHERE owner_id = ${ownerId}`;
  if ((accounts?.n ?? 0) === 1 && posts >= 10) {
    recs.push({ key: 'connectMore', weight: 20, tone: 'try', vars: {} });
  }

  return recs.sort((a, b) => b.weight - a.weight);
}

/** Headline counts for the history panel. */
export async function getHistorySummary(ownerId: string) {
  await ensureSchema();
  const [row] = await sql!`
    SELECT count(*)::int AS posts,
           count(*) FILTER (WHERE platform = 'instagram')::int AS instagram,
           count(*) FILTER (WHERE platform = 'facebook')::int AS facebook,
           sum(COALESCE(comments, 0))::int AS comments,
           sum(COALESCE(likes, 0))::int AS likes,
           max(fetched_at) AS fetched_at,
           min(published_at) AS oldest,
           max(published_at) AS newest
    FROM post_stats WHERE owner_id = ${ownerId}`;
  return row || null;
}
