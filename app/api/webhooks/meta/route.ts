import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema, hasDb } from '@/lib/db';
import {
  commentOnPost,
  sendPrivateReply,
  commentOnInstagramMedia,
} from '@/lib/meta';

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'socialflow_verify';

// GET — Meta webhook verification handshake
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (
    p.get('hub.mode') === 'subscribe' &&
    p.get('hub.verify_token') === VERIFY_TOKEN
  ) {
    return new NextResponse(p.get('hub.challenge') || '', { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

interface CommentEvent {
  platform: 'facebook' | 'instagram';
  pageOrIgId: string;
  commentId: string;
  postId: string;
  text: string;
  fromId: string;
  fromName: string;
}

// POST — receive comment events and run matching automations
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return new NextResponse('OK', { status: 200 });
  }

  // Always ack fast; process best-effort.
  try {
    if (hasDb) await processEvents(body);
  } catch (e) {
    console.error('webhook processing error', e);
  }
  return new NextResponse('OK', { status: 200 });
}

function extractEvents(body: any): CommentEvent[] {
  const events: CommentEvent[] = [];
  if (!body?.entry) return events;

  for (const entry of body.entry) {
    for (const change of entry.changes || []) {
      const v = change.value || {};
      // Facebook page feed comment
      if (
        body.object === 'page' &&
        change.field === 'feed' &&
        v.item === 'comment' &&
        v.verb === 'add'
      ) {
        events.push({
          platform: 'facebook',
          pageOrIgId: entry.id,
          commentId: v.comment_id,
          postId: v.post_id,
          text: v.message || '',
          fromId: v.from?.id || '',
          fromName: v.from?.name || '',
        });
      }
      // Instagram comment
      if (body.object === 'instagram' && change.field === 'comments') {
        events.push({
          platform: 'instagram',
          pageOrIgId: entry.id,
          commentId: v.id,
          postId: v.media?.id || '',
          text: v.text || '',
          fromId: v.from?.id || '',
          fromName: v.from?.username || '',
        });
      }
    }
  }
  return events;
}

function keywordMatches(
  text: string,
  keywords: string[],
  matchType: string
): string | null {
  const t = (text || '').toLowerCase();
  for (const kw of keywords) {
    const k = kw.toLowerCase().trim();
    if (!k) continue;
    if (matchType === 'exact' ? t === k : t.includes(k)) return kw;
  }
  return null;
}

async function processEvents(body: any) {
  await ensureSchema();
  const events = extractEvents(body);

  for (const ev of events) {
    if (!ev.commentId) continue;

    // Resolve the page token. For FB the entry id IS the page id; for IG it's
    // the IG account id, so we match on ig_id.
    const tokenRows =
      ev.platform === 'facebook'
        ? await sql!`SELECT * FROM page_tokens WHERE page_id = ${ev.pageOrIgId} LIMIT 1`
        : await sql!`SELECT * FROM page_tokens WHERE ig_id = ${ev.pageOrIgId} LIMIT 1`;
    const tokenRow = tokenRows[0];
    if (!tokenRow) continue;
    const pageToken = tokenRow.access_token as string;
    const pageId = tokenRow.page_id as string;

    // Find active automations for this page + platform.
    const autos = await sql!`
      SELECT * FROM automations
      WHERE page_id = ${pageId}
        AND platform = ${ev.platform}
        AND status = 'active'
    `;

    for (const a of autos) {
      // Post scope check
      if (a.post_scope === 'specific_post' && a.post_id && a.post_id !== ev.postId) {
        continue;
      }

      // Keyword check (any_comment when no keywords)
      let matched: string | null = null;
      if (a.keywords && a.keywords.length > 0) {
        matched = keywordMatches(ev.text, a.keywords, a.match_type);
        if (!matched) continue;
      }

      // Don't reply to the page's own comments.
      if (ev.fromId && ev.fromId === pageId) continue;

      let publicStatus = 'skipped';
      let dmStatus = 'skipped';
      let errorMessage: string | null = null;

      // once_per_user — skip if this commenter already handled.
      if (a.once_per_user && ev.fromId) {
        const seen = await sql!`
          SELECT 1 FROM dm_sent
          WHERE automation_id = ${a.id} AND commenter_id = ${ev.fromId} LIMIT 1
        `;
        if (seen.length > 0) {
          await logTrigger(a, ev, matched, 'skipped', 'skipped', 'already_handled');
          continue;
        }
      }

      // Public reply
      if (a.public_reply_enabled && a.public_replies?.length > 0) {
        try {
          const reply =
            a.public_replies[
              Math.floor(Math.random() * a.public_replies.length)
            ];
          if (reply?.trim()) {
            if (ev.platform === 'facebook') {
              await commentOnPost(ev.commentId, reply, pageToken);
            } else {
              await commentOnInstagramMedia(ev.commentId, reply, pageToken);
            }
            publicStatus = 'sent';
          }
        } catch (e: any) {
          publicStatus = 'failed';
          errorMessage = e.message;
        }
      }

      // DM (private reply) — Facebook only via comment_id
      if (a.dm_enabled && a.dm_message && ev.platform === 'facebook') {
        try {
          const msg = a.dm_link
            ? `${a.dm_message}\n\n${a.dm_link}`
            : a.dm_message;
          await sendPrivateReply(ev.commentId, msg, pageToken);
          dmStatus = 'sent';
        } catch (e: any) {
          dmStatus = 'failed';
          errorMessage = errorMessage || e.message;
        }
      }

      // Record once_per_user + counters + log
      if (ev.fromId) {
        await sql!`
          INSERT INTO dm_sent (automation_id, commenter_id)
          VALUES (${a.id}, ${ev.fromId})
          ON CONFLICT DO NOTHING
        `;
      }
      await sql!`
        UPDATE automations SET trigger_count = trigger_count + 1 WHERE id = ${a.id}
      `;
      await logTrigger(a, ev, matched, publicStatus, dmStatus, errorMessage);
    }
  }
}

async function logTrigger(
  a: any,
  ev: CommentEvent,
  matched: string | null,
  publicStatus: string,
  dmStatus: string,
  errorMessage: string | null
) {
  await sql!`
    INSERT INTO trigger_logs (
      automation_id, platform, post_id, comment_id, commenter_id,
      commenter_name, comment_text, matched_keyword,
      public_reply_status, dm_status, error_message
    ) VALUES (
      ${a.id}, ${ev.platform}, ${ev.postId}, ${ev.commentId}, ${ev.fromId},
      ${ev.fromName}, ${ev.text}, ${matched},
      ${publicStatus}, ${dmStatus}, ${errorMessage}
    )
  `;
}
