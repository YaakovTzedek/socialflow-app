import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema, hasDb } from '@/lib/db';
import {
  listComments,
  replyToComment,
  sendPrivateReply,
  listInstagramComments,
  replyToInstagramComment,
  listPagePosts,
  listInstagramMedia,
} from '@/lib/meta';

export const maxDuration = 60;

const CRON_KEY = process.env.CRON_KEY || 'socialflow_verify_2026';

function keywordMatch(text: string, keywords: string[], matchType: string): string | null {
  const t = (text || '').toLowerCase();
  for (const kw of keywords) {
    const k = (kw || '').toLowerCase().trim();
    if (!k) continue;
    if (matchType === 'exact' ? t === k : t.includes(k)) return kw;
  }
  return null;
}

// GET /api/cron/poll?key=...  → poll comments for all active automations and act
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== CRON_KEY) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!hasDb) return NextResponse.json({ error: 'no_db' });

  const debug = req.nextUrl.searchParams.get('debug') === '1';
  await ensureSchema();
  const automations = await sql!`SELECT * FROM automations WHERE status = 'active'`;
  const summary: any[] = [];
  const debugComments: any[] = [];

  for (const a of automations) {
    const tokenRow = (
      await sql!`SELECT access_token, ig_id FROM page_tokens WHERE page_id = ${a.page_id} LIMIT 1`
    )[0];
    if (!tokenRow) {
      summary.push({ automation: a.name, skipped: 'no_page_token' });
      continue;
    }
    const pageToken = tokenRow.access_token as string;
    const isIG = a.platform === 'instagram';

    try {
      // Resolve which posts/media to scan.
      let postIds: string[] = [];
      if (a.post_scope === 'specific_post' && a.post_id) {
        postIds = [a.post_id];
      } else {
        // all_posts → scan the most recent posts/media
        if (isIG && tokenRow.ig_id) {
          const media = await listInstagramMedia(tokenRow.ig_id, pageToken);
          postIds = media.slice(0, 10).map((m) => m.id);
        } else {
          const posts = await listPagePosts(a.page_id, pageToken);
          postIds = posts.slice(0, 10).map((p) => p.id);
        }
      }

      let matched = 0;
      for (const postId of postIds) {
        const comments = isIG
          ? await listInstagramComments(postId, pageToken)
          : await listComments(postId, pageToken);

        for (const c of comments) {
          const commentId = c.id;
          const text = isIG ? (c as any).text : (c as any).message;
          const fromId = isIG ? (c as any).username : (c as any).from?.id;
          const fromName = isIG ? (c as any).username : (c as any).from?.name;
          if (debug) {
            const ct = isIG ? (c as any).timestamp : (c as any).created_time;
            const seenD = await sql!`SELECT 1 FROM processed_comments WHERE automation_id=${a.id} AND comment_id=${commentId} LIMIT 1`;
            debugComments.push({
              comment: text, from: fromName, time: ct,
              automation_created: a.created_at,
              is_newer_than_automation: ct && a.created_at ? Date.parse(ct) >= Date.parse(a.created_at) : null,
              already_processed: seenD.length > 0,
              keyword_match: a.keywords?.length ? keywordMatch(text, a.keywords, a.match_type) : '(any)',
            });
          }
          if (!commentId || !text) continue;

          // Dedupe — already handled?
          const seen = await sql!`
            SELECT 1 FROM processed_comments
            WHERE automation_id = ${a.id} AND comment_id = ${commentId} LIMIT 1`;
          if (seen.length > 0) continue;

          // Skip comments created before the automation existed (baseline old
          // comments as processed so we never reply to pre-existing threads).
          const cTime = isIG ? (c as any).timestamp : (c as any).created_time;
          if (cTime && a.created_at && Date.parse(cTime) < Date.parse(a.created_at)) {
            await sql!`
              INSERT INTO processed_comments (automation_id, comment_id)
              VALUES (${a.id}, ${commentId}) ON CONFLICT DO NOTHING`;
            continue;
          }

          // Keyword filter (empty = any comment)
          let kw: string | null = null;
          if (a.keywords?.length > 0) {
            kw = keywordMatch(text, a.keywords, a.match_type);
            if (!kw) continue;
          }

          // Don't reply to the page's own comments (FB).
          if (!isIG && fromId && fromId === a.page_id) continue;

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

          if (a.dm_enabled && a.dm_message && !isIG) {
            try {
              const msg = a.dm_link ? `${a.dm_message}\n\n${a.dm_link}` : a.dm_message;
              await sendPrivateReply(commentId, msg, pageToken);
              dmStatus = 'sent';
            } catch (e: any) {
              dmStatus = 'failed';
              err = err || e.message;
            }
          }

          // Mark processed + log + bump counter.
          await sql!`
            INSERT INTO processed_comments (automation_id, comment_id)
            VALUES (${a.id}, ${commentId}) ON CONFLICT DO NOTHING`;
          await sql!`UPDATE automations SET trigger_count = trigger_count + 1 WHERE id = ${a.id}`;
          await sql!`
            INSERT INTO trigger_logs (automation_id, platform, post_id, comment_id,
              commenter_id, commenter_name, comment_text, matched_keyword,
              public_reply_status, dm_status, error_message)
            VALUES (${a.id}, ${a.platform}, ${postId}, ${commentId}, ${String(fromId || '')},
              ${fromName || ''}, ${text}, ${kw}, ${publicStatus}, ${dmStatus}, ${err})`;
          matched++;
        }
      }
      summary.push({ automation: a.name, platform: a.platform, posts_scanned: postIds.length, new_matches: matched });
    } catch (e: any) {
      summary.push({ automation: a.name, error: e.message });
    }
  }

  return NextResponse.json({
    ran_at: new Date().toISOString(),
    summary,
    ...(debug ? { debug_comments: debugComments } : {}),
  });
}
