import { sql, ensureSchema } from './db';
import {
  listAllInstagramMedia, listPagePosts, getMediaInsights, getInstagramFollowers,
} from './meta';

/**
 * Pull an account's own post history into our database.
 *
 * Recommendations are only worth reading if they come from the account's real
 * record, so this walks every post the connected accounts have published, with
 * likes, comments and, where Instagram serves them, reach, saves and shares.
 * It is deliberately a background job: a full history is hundreds of Graph
 * calls and belongs nowhere near a page load.
 *
 * Re-running is safe and cheap. Rows are keyed by post, so a second pass
 * refreshes the numbers on posts that are still collecting engagement instead
 * of duplicating them.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Meta allows about two calls a second per account. */
const PACE_MS = 550;

export interface IngestResult { owner: string; page: string; instagram: number; facebook: number; insights: number; error?: string }

export async function ingestOwnerPosts(ownerId: string, opts: { maxPosts?: number; withInsights?: boolean; budgetMs?: number } = {}): Promise<IngestResult[]> {
  await ensureSchema();
  const started = Date.now();
  const budget = opts.budgetMs ?? 45_000;
  const maxPosts = opts.maxPosts ?? 200;

  const pages = await sql!`SELECT page_id, page_name, ig_id, access_token FROM page_tokens WHERE owner_id = ${ownerId}`;
  const out: IngestResult[] = [];

  for (const p of pages as any[]) {
    const res: IngestResult = { owner: ownerId, page: p.page_name || p.page_id, instagram: 0, facebook: 0, insights: 0 };
    try {
      let followers: number | null = null;
      if (p.ig_id) {
        followers = await getInstagramFollowers(p.ig_id, p.access_token);
        const media = await listAllInstagramMedia(p.ig_id, p.access_token, maxPosts);
        for (const m of media) {
          // Insights are the expensive part: one extra call per post. Only for
          // posts we have not measured yet, and only while there is time left.
          let ins = null;
          if (opts.withInsights !== false && Date.now() - started < budget) {
            const [known] = await sql!`SELECT reach FROM post_stats WHERE owner_id = ${ownerId} AND post_id = ${m.id}`;
            if (!known || known.reach === null) {
              ins = await getMediaInsights(m.id, p.access_token);
              if (ins) res.insights++;
              await sleep(PACE_MS);
            }
          }
          await sql!`
            INSERT INTO post_stats (owner_id, page_id, platform, post_id, media_type, caption, permalink,
              published_at, likes, comments, reach, impressions, saves, shares, views, followers, fetched_at)
            VALUES (${ownerId}, ${p.page_id}, ${'instagram'}, ${m.id}, ${m.media_type || null},
              ${(m.caption || '').slice(0, 2000)}, ${m.permalink || null}, ${m.timestamp || null},
              ${m.like_count ?? null}, ${m.comments_count ?? null},
              ${ins?.reach ?? null}, ${ins?.impressions ?? null}, ${ins?.saved ?? null}, ${ins?.shares ?? null}, ${ins?.views ?? null},
              ${followers}, now())
            ON CONFLICT (owner_id, post_id) DO UPDATE SET
              likes = EXCLUDED.likes, comments = EXCLUDED.comments,
              reach = COALESCE(EXCLUDED.reach, post_stats.reach),
              impressions = COALESCE(EXCLUDED.impressions, post_stats.impressions),
              saves = COALESCE(EXCLUDED.saves, post_stats.saves),
              shares = COALESCE(EXCLUDED.shares, post_stats.shares),
              views = COALESCE(EXCLUDED.views, post_stats.views),
              followers = COALESCE(EXCLUDED.followers, post_stats.followers),
              caption = EXCLUDED.caption, permalink = EXCLUDED.permalink, fetched_at = now()`;
          res.instagram++;
          if (Date.now() - started > budget) break;
        }
      }

      const posts = await listPagePosts(p.page_id, p.access_token);
      for (const fp of posts) {
        await sql!`
          INSERT INTO post_stats (owner_id, page_id, platform, post_id, media_type, caption, permalink,
            published_at, likes, comments, followers, fetched_at)
          VALUES (${ownerId}, ${p.page_id}, ${'facebook'}, ${fp.id}, ${'POST'},
            ${(fp.message || fp.story || '').slice(0, 2000)}, ${fp.permalink_url || null}, ${fp.created_time || null},
            ${fp.likes?.summary?.total_count ?? null}, ${fp.comments?.summary?.total_count ?? null}, null, now())
          ON CONFLICT (owner_id, post_id) DO UPDATE SET
            likes = EXCLUDED.likes, comments = EXCLUDED.comments,
            caption = EXCLUDED.caption, permalink = EXCLUDED.permalink, fetched_at = now()`;
        res.facebook++;
      }
    } catch (e: any) {
      res.error = e.message;
    }
    out.push(res);
    if (Date.now() - started > budget) break;
  }
  return out;
}

/** Owners whose history is missing or stale, oldest first. */
export async function ownersNeedingIngest(limit = 3): Promise<string[]> {
  await ensureSchema();
  const rows = await sql!`
    SELECT t.owner_id, max(s.fetched_at) AS last
    FROM page_tokens t LEFT JOIN post_stats s ON s.owner_id = t.owner_id
    GROUP BY t.owner_id
    HAVING max(s.fetched_at) IS NULL OR max(s.fetched_at) < now() - interval '20 hours'
    ORDER BY last NULLS FIRST
    LIMIT ${limit}`;
  return (rows as any[]).map((r) => r.owner_id);
}
