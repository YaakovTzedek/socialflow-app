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
  listInstagramConversations,
  getConversationMessages,
  sendInstagramMessage,
} from '@/lib/meta';
import { isInbound, isStoryReply, storyIdOf } from '@/lib/inbox';

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
           a.dm_message, a.dm_link, a.once_per_user, a.post_scope, l.commenter_id, l.dm_attempts,
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
      // A story reply is answered as a plain DM to the sender (comment_id holds
      // the message id there, which private replies cannot target).
      const sent = r.post_scope === 'story_replies'
        ? await sendInstagramMessage(String(r.commenter_id || ''), msg, r.access_token)
        : r.platform === 'instagram'
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

/** Conversations re-read per page on each pass, and messages per conversation. */
const STORY_CONVERSATIONS = 25;
const STORY_MESSAGES = 10;
/** Pages whose inbox is read at the same time. */
const STORY_PAGE_CONCURRENCY = 2;
/** Meta refuses a DM after 24 hours; stay safely inside it. */
const STORY_MAX_AGE_MS = 23 * 60 * 60 * 1000;

/**
 * Story replies: answer Instagram DMs that reply to a Story.
 * Inbound DMs (post_scope = 'dm_inbound', Yaakov 26.9.2026): the same pass also
 * answers any new inbound message, a welcome reply to everyone who writes,
 * including people who reply to an ad. A story reply prefers a story
 * automation and falls back to the inbound one; once_per_user keeps it to one
 * welcome per person.
 *
 * There are no webhooks, so each page with an active story_replies automation
 * has its inbox re-read: only conversations updated since story_poll_state
 * says we last looked, and in them only inbound messages carrying a `story`
 * field created after that moment. The first pass for a page only records
 * now(). A message is claimed in processed_comments (message id as
 * comment_id) before anything is sent, and one message triggers at most one
 * automation (the oldest that matches). Every trigger lands in trigger_logs,
 * so the log, the brain and the monthly DM quota count it like a comment.
 */
async function pollStoryReplies(opts: {
  automations: any[];
  exhausted: Set<string>;
  started: number;
  brandingLine: (owner: string) => Promise<string | null>;
}): Promise<any[]> {
  const { automations, exhausted, started, brandingLine } = opts;
  const summary: any[] = [];
  const byPage = new Map<string, any[]>();
  for (const a of automations) {
    if (a.platform !== 'instagram') continue;
    const list = byPage.get(a.page_id) || [];
    list.push(a);
    byPage.set(a.page_id, list);
  }

  await mapPool(Array.from(byPage.entries()), STORY_PAGE_CONCURRENCY, async ([pageId, autosAll]) => {
    if (Date.now() - started > TIME_BUDGET_MS) {
      summary.push({ story_page: pageId, skipped: 'time_budget' });
      return;
    }
    // Owners past their quota are skipped and the page is not advanced, so an
    // upgrade inside the 24 hour window still catches up on those replies.
    const autos = autosAll.filter((a) => !exhausted.has(a.owner_id));
    if (!autos.length) {
      summary.push({ story_page: pageId, skipped: 'dm_quota' });
      return;
    }
    try {
      const [tokenRow] = await sql!`SELECT access_token, ig_id FROM page_tokens WHERE page_id = ${pageId} LIMIT 1`;
      if (!tokenRow) {
        summary.push({ story_page: pageId, skipped: 'no_page_token' });
        return;
      }
      const pageToken = tokenRow.access_token as string;
      const igId = (tokenRow.ig_id as string | null) || null;
      // Without our IG id we cannot tell their messages from ours.
      if (!igId) {
        summary.push({ story_page: pageId, skipped: 'no_instagram' });
        return;
      }

      const [state] = await sql!`SELECT last_checked FROM story_poll_state WHERE page_id = ${pageId}`;
      if (!state) {
        await sql!`INSERT INTO story_poll_state (page_id, last_checked) VALUES (${pageId}, now()) ON CONFLICT DO NOTHING`;
        summary.push({ story_page: pageId, baseline: true });
        return;
      }
      const lastChecked = new Date(state.last_checked as any).getTime();
      // Taken before reading, so a message that lands while this pass runs is
      // still newer than the next pass's cutoff.
      const passStart = new Date();

      const convs = await listInstagramConversations(pageId, pageToken, STORY_CONVERSATIONS);
      // A minute of slack for clock skew between Meta and us; dedupe covers overlap.
      const fresh = convs.filter((c) => !c.updated_time || Date.parse(c.updated_time) > lastChecked - 60_000);
      const perConv = await mapPool(fresh, META_CONCURRENCY, async (c) => {
        try {
          return { msgs: await getConversationMessages(c.id, pageToken, STORY_MESSAGES) };
        } catch (e: any) {
          return { msgs: [] as any[], error: e.message as string };
        }
      });

      const ordered = [...autos].sort((x, y) => Date.parse(x.created_at) - Date.parse(y.created_at));
      let matched = 0;
      for (const { msgs } of perConv) {
        // Oldest first, so the log reads in the order people wrote.
        for (const msg of [...msgs].reverse()) {
          if (!msg?.id || !isInbound(msg, igId, pageId)) continue;
          const story = isStoryReply(msg);
          // Their own outbound is filtered by isInbound; a message we sent from another tool is too.
          const created = msg.created_time ? Date.parse(msg.created_time) : NaN;
          if (Number.isNaN(created) || created <= lastChecked) continue;
          if (Date.now() - created > STORY_MAX_AGE_MS) continue;
          const text = msg.message || '';
          const senderId = String(msg.from?.id || '');
          if (!senderId) continue;

          let a: any = null;
          let kw: string | null = null;
          // A story reply goes to story automations first, then to the inbound one; a plain DM only to inbound.
          // The welcome is for a new conversation: someone we already answered (from any tool) is mid-chat, not a new lead.
          const priorReply = msgs.some((m: any) => m?.id && !isInbound(m, igId, pageId) && m.created_time && Date.parse(m.created_time) < created);
          const inboundAutos = priorReply ? [] : ordered.filter((c) => c.post_scope === 'dm_inbound');
          const candidates = story ? [...ordered.filter((c) => c.post_scope === 'story_replies'), ...inboundAutos] : inboundAutos;
          for (const cand of candidates) {
            if (cand.created_at && created < Date.parse(cand.created_at)) continue;
            if (cand.keywords?.length > 0) {
              const k = keywordMatch(text, cand.keywords, cand.match_type);
              if (!k) continue;
              kw = k;
            } else {
              kw = null;
            }
            a = cand;
            break;
          }
          if (!a) continue;

          const claimed = await sql!`
            INSERT INTO processed_comments (automation_id, comment_id)
            VALUES (${a.id}, ${msg.id}) ON CONFLICT DO NOTHING RETURNING comment_id`;
          if (claimed.length === 0) continue;

          let dmStatus = 'skipped';
          let err: string | null = null;
          let dmMessageId: string | null = null;
          let dmRetryable = false;
          if (a.dm_enabled && a.dm_message) {
            const already = a.once_per_user
              ? await sql!`SELECT 1 FROM dm_sent WHERE automation_id = ${a.id} AND commenter_id = ${senderId} LIMIT 1`
              : [];
            if (already.length > 0) {
              dmStatus = 'skipped_duplicate';
            } else {
              const out = dmTextFor(a, await brandingLine(a.owner_id));
              try {
                const sent = await sendInstagramMessage(senderId, out, pageToken);
                dmStatus = 'sent';
                dmMessageId = sent.messageId;
                await sql!`INSERT INTO dm_sent (automation_id, commenter_id) VALUES (${a.id}, ${senderId}) ON CONFLICT DO NOTHING`;
              } catch (e: any) {
                dmStatus = 'failed';
                dmRetryable = e?.retryable !== false;
                err = e.message;
              }
              await sleep(DM_PACE_MS);
            }
          }

          await sql!`UPDATE automations SET trigger_count = trigger_count + 1 WHERE id = ${a.id}`;
          await sql!`
            INSERT INTO trigger_logs (automation_id, platform, post_id, comment_id,
              commenter_id, commenter_name, comment_text, matched_keyword,
              public_reply_status, dm_status, error_message, dm_message_id, dm_attempts, dm_retryable)
            VALUES (${a.id}, 'instagram', ${storyIdOf(msg)}, ${msg.id}, ${senderId},
              ${msg.from?.username || msg.from?.name || ''}, ${text}, ${kw}, 'skipped', ${dmStatus}, ${err},
              ${dmMessageId}, ${dmStatus === 'skipped_duplicate' || dmStatus === 'skipped' ? 0 : 1}, ${dmRetryable})`;
          matched++;
        }
      }

      // Advance only when every conversation was read; a failed read is retried next pass.
      const fetchErrors = perConv.filter((p) => p.error).length;
      if (!fetchErrors) {
        await sql!`UPDATE story_poll_state SET last_checked = ${passStart} WHERE page_id = ${pageId}`;
      }
      summary.push({
        story_page: pageId, conversations_read: fresh.length, new_matches: matched,
        ...(fetchErrors ? { fetch_errors: fetchErrors } : {}),
      });
    } catch (e: any) {
      summary.push({ story_page: pageId, error: e.message });
    }
  });
  return summary;
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
  // Story-reply automations read the DM inbox, not post comments: they get
  // their own pass below and never enter the comment loop.
  const storyAutos = all.filter((a: any) => a.post_scope === 'story_replies' || a.post_scope === 'dm_inbound');
  const commentAutos = all.filter((a: any) => a.post_scope !== 'story_replies' && a.post_scope !== 'dm_inbound');
  // Rotate the starting point every run so a slow pass never starves the same
  // automations twice in a row.
  const offset = commentAutos.length ? Math.floor(started / 180_000) % commentAutos.length : 0;
  const automations = [...commentAutos.slice(offset), ...commentAutos.slice(0, offset)];
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

  // Replies to Instagram Stories (DM inbox), inside the same time budget.
  let storySummary: any[] = [];
  if (storyAutos.length && Date.now() - started < TIME_BUDGET_MS) {
    try {
      storySummary = await pollStoryReplies({ automations: storyAutos, exhausted, started, brandingLine });
    } catch (e: any) {
      storySummary = [{ error: e.message }];
    }
  }

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
    ...(storySummary.length ? { story_replies: storySummary } : {}),
    ...(debug ? { debug_comments: debugComments } : {}),
  });
}
