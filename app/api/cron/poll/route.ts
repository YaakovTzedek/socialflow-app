import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema, hasDb } from '@/lib/db';
import { quotaExhaustedOwners, getEntitlement } from '@/lib/entitlements';
import { getMessages } from '@/lib/i18n';
import {
  listComments,
  replyToComment,
  sendPrivateReply,
  listInstagramComments,
  replyToInstagramComment,
  sendInstagramPrivateReply,
  listPagePosts,
  listInstagramMedia,
  getInstagramUsername,
} from '@/lib/meta';

export const maxDuration = 60;

const CRON_KEY = process.env.CRON_KEY || 'socialflow_verify_2026';
// Vercel kills the function at 60s. Stop starting new automations after this
// and return what was done; the next run picks up where this one rotated to.
const TIME_BUDGET_MS = 45_000;
// Meta calls per automation run in parallel (comments for 25 posts one by one
// took 20-40s and was the main reason runs timed out on 20.9.2026).
const META_CONCURRENCY = 6;

/** Meta allows roughly two calls a second per account. */
const DM_PACE_MS = 600;
/** How many times a transient failure is retried before it is given up on. */
const MAX_DM_ATTEMPTS = 4;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The message body, identical on the first attempt and on every retry. */
function dmTextFor(a: any, branding: string | null): string {
  let msg = a.dm_link ? `${a.dm_message}\n\n${a.dm_link}` : a.dm_message;
  if (branding) msg += '\n\n' + branding;
  return msg;
}

/**
 * Retry the private messages that failed for a transient reason.
 *
 * A comment is claimed in processed_comments before anything is sent, so
 * without this pass a single rate-limit answer from Meta lost that lead for
 * good: the comment would never be looked at again. Only rows inside Meta's
 * 24 hour messaging window are retried, because after it the send would be
 * refused anyway. A row with zero attempts predates the retry columns, so it
 * gets one pass regardless of the flag.
 */
async function retryFailedDms(brandingLine: (owner: string) => Promise<string | null>): Promise<{ retried: number; recovered: number }> {
  const rows = await sql!`
    SELECT l.id, l.comment_id, l.platform, a.id AS automation_id, a.owner_id, a.page_id,
           a.dm_message, a.dm_link, a.once_per_user, l.commenter_id, l.dm_attempts,
           t.access_token, t.ig_id
    FROM trigger_logs l
    JOIN automations a ON a.id = l.automation_id
    JOIN page_tokens t ON t.page_id = a.page_id AND t.owner_id = a.owner_id
    WHERE l.dm_status = 'failed'
      AND (l.dm_retryable = true OR l.dm_attempts = 0)
      AND l.dm_attempts < ${MAX_DM_ATTEMPTS}
      AND l.created_at > now() - interval '23 hours'
    ORDER BY l.created_at ASC LIMIT 25`;

  let recovered = 0;
  for (const r of rows as any[]) {
    const msg = dmTextFor(r, await brandingLine(r.owner_id));
    try {
      const sent = r.platform === 'instagram'
        ? await sendInstagramPrivateReply(r.ig_id || '', r.comment_id, msg, r.access_token)
        : await sendPrivateReply(r.comment_id, msg, r.access_token);
      await sql!`
        UPDATE trigger_logs
        SET dm_status = 'sent', dm_message_id = ${sent.messageId}, error_message = NULL,
            dm_attempts = dm_attempts + 1, dm_retryable = false
        WHERE id = ${r.id}`;
      if (r.commenter_id) {
        await sql!`INSERT INTO dm_sent (automation_id, commenter_id) VALUES (${r.automation_id}, ${r.commenter_id}) ON CONFLICT DO NOTHING`;
      }
      recovered++;
    } catch (e: any) {
      await sql!`
        UPDATE trigger_logs
        SET dm_attempts = dm_attempts + 1, error_message = ${e.message},
            dm_retryable = ${e?.retryable !== false}
        WHERE id = ${r.id}`;
    }
    await sleep(DM_PACE_MS);
  }
  return { retried: rows.length, recovered };
}

function keywordMatch(text: string, keywords: string[], matchType: string): string | null {
  const t = (text || '').toLowerCase();
  for (const kw of keywords) {
    const k = (kw || '').toLowerCase().trim();
    if (!k) continue;
    if (matchType === 'exact' ? t === k : t.includes(k)) return kw;
  }
  return null;
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

// GET /api/cron/poll?key=...  → poll comments for all active automations and act
//
// Query budget matters here: this runs every few minutes around the clock, and
// the first database (Neon free tier) died of it — one SELECT per comment per
// automation per pass burned the plan's compute quota in two days. Now it is
// ONE dedupe lookup per automation (comment_id = ANY(...)) and one batched
// baseline insert. Two pollers (GitHub Actions + the Mac launchd job) can
// overlap, so a comment is CLAIMED in processed_comments before anything is
// sent: whoever inserts the row first answers, the other skips.
export async function GET(req: NextRequest) {
  // Two callers: manual/launchd/GitHub pass ?key=..., Vercel Cron sends
  // "Authorization: Bearer <CRON_SECRET>" (set in the project env).
  const bearer = req.headers.get('authorization') || '';
  const vercelCronOk = !!process.env.CRON_SECRET && bearer === `Bearer ${process.env.CRON_SECRET}`;
  if (req.nextUrl.searchParams.get('key') !== CRON_KEY && !vercelCronOk) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!hasDb) return NextResponse.json({ error: 'no_db' });

  const started = Date.now();
  const debug = req.nextUrl.searchParams.get('debug') === '1';
  await ensureSchema();
  const all = await sql!`SELECT * FROM automations WHERE status = 'active' ORDER BY created_at`;
  // Rotate the starting point every run so a slow pass never starves the same
  // automations twice in a row.
  const offset = all.length ? Math.floor(started / 180_000) % all.length : 0;
  const automations = [...all.slice(offset), ...all.slice(0, offset)];
  const summary: any[] = [];
  const debugComments: any[] = [];
  // Plan metering: an owner past this month's DM quota is skipped entirely
  // (comments are not claimed, so an upgrade catches up on them).
  const exhausted = await quotaExhaustedOwners(all.map((a: any) => a.owner_id));
  const brandingCache = new Map<string, string | null>();
  const brandingLine = async (owner: string) => {
    if (!brandingCache.has(owner)) {
      try {
        const branding = (await getEntitlement(owner)).plan.limits.branding;
        const [pref] = await sql!`SELECT locale FROM owner_prefs WHERE owner_id = ${owner}`;
        brandingCache.set(owner, branding ? getMessages(pref?.locale).server.brandingLine : null);
      } catch { brandingCache.set(owner, null); }
    }
    return brandingCache.get(owner)!;
  };

  // Per-run caches: page tokens and our own IG username (to spot threads we
  // already answered, e.g. before a database migration wiped the dedupe table).
  const tokenCache = new Map<string, { access_token: string; ig_id: string | null }>();
  const usernameCache = new Map<string, string>();

  // Automations run 4 at a time: each one is mostly waiting on Meta, and the
  // dedupe rows are claimed per comment, so concurrent automations are safe.
  const processAutomation = async (a: any) => {
    if (Date.now() - started > TIME_BUDGET_MS) {
      summary.push({ automation: a.name, skipped: 'time_budget' });
      return;
    }
    if (exhausted.has(a.owner_id)) {
      summary.push({ automation: a.name, skipped: 'dm_quota' });
      return;
    }
    let tokenRow = tokenCache.get(a.page_id);
    if (!tokenRow) {
      const row = (
        await sql!`SELECT access_token, ig_id FROM page_tokens WHERE page_id = ${a.page_id} LIMIT 1`
      )[0] as { access_token: string; ig_id: string | null } | undefined;
      if (row) {
        tokenRow = row;
        tokenCache.set(a.page_id, row);
      }
    }
    if (!tokenRow) {
      summary.push({ automation: a.name, skipped: 'no_page_token' });
      return;
    }
    const pageToken = tokenRow.access_token;
    const isIG = a.platform === 'instagram';

    let ourIgUsername = '';
    if (isIG && tokenRow.ig_id) {
      ourIgUsername = usernameCache.get(tokenRow.ig_id) || '';
      if (!ourIgUsername) {
        try {
          ourIgUsername = (await getInstagramUsername(tokenRow.ig_id, pageToken)).toLowerCase();
          usernameCache.set(tokenRow.ig_id, ourIgUsername);
        } catch {
          /* best effort */
        }
      }
    }

    try {
      // Resolve which posts/media to scan.
      let postIds: string[] = [];
      if (a.post_scope === 'specific_post' && a.post_id) {
        postIds = [a.post_id];
      } else {
        // all_posts → scan the most recent posts/media. The window has to be wide enough to
        // survive a burst of publishing: 9 trial reels in one afternoon pushed a reel that was
        // still collecting comments out of a 10-item window, and its commenters got nothing.
        if (isIG && tokenRow.ig_id) {
          const media = await listInstagramMedia(tokenRow.ig_id, pageToken);
          postIds = media.slice(0, 25).map((m) => m.id);
        } else {
          const posts = await listPagePosts(a.page_id, pageToken);
          postIds = posts.slice(0, 25).map((p) => p.id);
        }
      }

      // Fetch every post's comments in parallel, then dedupe in ONE query.
      const perPost = await mapPool(postIds, META_CONCURRENCY, async (postId) => {
        try {
          const comments = isIG
            ? await listInstagramComments(postId, pageToken)
            : await listComments(postId, pageToken);
          return { postId, comments };
        } catch (e: any) {
          return { postId, comments: [], error: e.message as string };
        }
      });
      const allIds = perPost.flatMap((p) => p.comments.map((c) => c.id).filter(Boolean));
      const seen = new Set<string>();
      if (allIds.length) {
        const seenRows = await sql!`
          SELECT comment_id FROM processed_comments
          WHERE automation_id = ${a.id} AND comment_id = ANY(${allIds})`;
        for (const r of seenRows) seen.add(r.comment_id as string);
      }

      let matched = 0;
      const toBaseline: string[] = [];
      for (const { postId, comments } of perPost) {
        for (const c of comments) {
          const commentId = c.id;
          const text = isIG ? (c as any).text : (c as any).message;
          const fromId = isIG ? (c as any).username : (c as any).from?.id;
          const fromName = isIG ? (c as any).username : (c as any).from?.name;
          const cTime = isIG ? (c as any).timestamp : (c as any).created_time;
          const olderThanAutomation =
            !!cTime && !!a.created_at && Date.parse(cTime) < Date.parse(a.created_at);
          // Instagram returns each comment's replies; if one is ours the thread was
          // already answered (by an earlier run, or by Yaakov by hand) — never twice.
          const answeredByUs =
            isIG && ourIgUsername
              ? ((c as any).replies?.data || []).some(
                  (r: any) => (r.username || '').toLowerCase() === ourIgUsername
                )
              : false;

          if (debug) {
            debugComments.push({
              comment: text, from: fromName, time: cTime,
              automation_created: a.created_at,
              is_newer_than_automation: cTime && a.created_at ? !olderThanAutomation : null,
              already_processed: seen.has(commentId),
              answered_by_us: answeredByUs,
              keyword_match: a.keywords?.length ? keywordMatch(text, a.keywords, a.match_type) : '(any)',
            });
          }
          if (!commentId || !text) continue;
          if (seen.has(commentId)) continue;

          // Baseline: comments older than the automation, or threads we already
          // answered, are recorded as processed and never replied to.
          if (olderThanAutomation || answeredByUs) {
            toBaseline.push(commentId);
            continue;
          }

          // Keyword filter (empty = any comment)
          let kw: string | null = null;
          if (a.keywords?.length > 0) {
            kw = keywordMatch(text, a.keywords, a.match_type);
            if (!kw) continue;
          }

          // Don't reply to our own comments.
          if (!isIG && fromId && fromId === a.page_id) continue;
          if (isIG && ourIgUsername && (fromId || '').toLowerCase() === ourIgUsername) continue;

          // Claim the comment before sending anything: a concurrent poller that
          // reaches the same comment gets no row back and skips it.
          const claimed = await sql!`
            INSERT INTO processed_comments (automation_id, comment_id)
            VALUES (${a.id}, ${commentId}) ON CONFLICT DO NOTHING RETURNING comment_id`;
          if (claimed.length === 0) continue;

          let publicStatus = 'skipped';
          let dmStatus = 'skipped';
          let err: string | null = null;

          if (a.public_reply_enabled && a.public_replies?.length > 0) {
            try {
              const reply = a.public_replies[Math.floor(Math.random() * a.public_replies.length)];
              if (reply?.trim()) {
                if (isIG) await replyToInstagramComment(commentId, reply, pageToken);
                else await replyToComment(commentId, reply, pageToken);
                publicStatus = 'sent';
              }
            } catch (e: any) {
              publicStatus = 'failed';
              err = e.message;
            }
          }

          let dmMessageId: string | null = null;
          let dmRetryable = false;
          if (a.dm_enabled && a.dm_message) {
            // once_per_user is honoured here, against dm_sent, so a person who
            // already got this automation's message is not messaged twice.
            const already = a.once_per_user && fromId
              ? await sql!`SELECT 1 FROM dm_sent WHERE automation_id = ${a.id} AND commenter_id = ${String(fromId)} LIMIT 1`
              : [];
            if (already.length > 0) {
              dmStatus = 'skipped_duplicate';
            } else {
              const msg = dmTextFor(a, await brandingLine(a.owner_id));
              try {
                const sent = isIG
                  ? await sendInstagramPrivateReply(tokenRow.ig_id || '', commentId, msg, pageToken)
                  : await sendPrivateReply(commentId, msg, pageToken);
                dmStatus = 'sent';
                dmMessageId = sent.messageId;
                if (fromId) {
                  await sql!`
                    INSERT INTO dm_sent (automation_id, commenter_id)
                    VALUES (${a.id}, ${String(fromId)}) ON CONFLICT DO NOTHING`;
                }
              } catch (e: any) {
                dmStatus = 'failed';
                dmRetryable = e?.retryable !== false;
                err = err || e.message;
              }
              // Meta allows about two calls a second per account. Pace the
              // sends so a burst of comments does not trip the rate limit.
              await sleep(DM_PACE_MS);
            }
          }

          await sql!`UPDATE automations SET trigger_count = trigger_count + 1 WHERE id = ${a.id}`;
          await sql!`
            INSERT INTO trigger_logs (automation_id, platform, post_id, comment_id,
              commenter_id, commenter_name, comment_text, matched_keyword,
              public_reply_status, dm_status, error_message, dm_message_id, dm_attempts, dm_retryable)
            VALUES (${a.id}, ${a.platform}, ${postId}, ${commentId}, ${String(fromId || '')},
              ${fromName || ''}, ${text}, ${kw}, ${publicStatus}, ${dmStatus}, ${err},
              ${dmMessageId}, ${dmStatus === 'skipped_duplicate' ? 0 : 1}, ${dmRetryable})`;
          matched++;
        }
      }

      if (toBaseline.length > 0) {
        const rows = toBaseline.map((id) => ({ automation_id: a.id, comment_id: id }));
        await sql!`
          INSERT INTO processed_comments ${sql!(rows, 'automation_id', 'comment_id')}
          ON CONFLICT DO NOTHING`;
      }
      const fetchErrors = perPost.filter((p) => p.error).length;
      summary.push({
        automation: a.name, platform: a.platform, posts_scanned: postIds.length, new_matches: matched,
        ...(fetchErrors ? { fetch_errors: fetchErrors } : {}),
      });
    } catch (e: any) {
      summary.push({ automation: a.name, error: e.message });
    }
  };
  await mapPool(automations, 4, processAutomation);

  // Recover the messages Meta refused for a transient reason on an earlier pass.
  let retry = { retried: 0, recovered: 0 };
  if (Date.now() - started < TIME_BUDGET_MS) {
    try { retry = await retryFailedDms(brandingLine); } catch { /* never fail the poll over the retry pass */ }
  }

  return NextResponse.json({
    ran_at: new Date().toISOString(),
    took_ms: Date.now() - started,
    dm_retry: retry,
    summary,
    ...(debug ? { debug_comments: debugComments } : {}),
  });
}
