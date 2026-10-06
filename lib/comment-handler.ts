/**
 * lib/comment-core.ts wired to Postgres and the Graph API. Used by both the poller and the Meta
 * webhook, so a comment is answered the same way (and only once) whichever of them sees it first.
 */
import { sql } from './db';
import { fillVars, type TemplateVars } from './template';
import { getEntitlement } from './entitlements';
import { getMessages } from './i18n';
import { replyToComment, replyToInstagramComment, sendPrivateReply, sendInstagramPrivateReply } from './meta';
import { openFollowupConversation } from './followup';
import type { CommentDeps } from './comment-core';

/** Meta allows roughly two calls a second per account. */
export const DM_PACE_MS = 600;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** The message body, identical on the first attempt and on every retry. */
export function dmTextFor(a: any, branding: string | null, vars: TemplateVars = {}): string {
  let msg = fillVars(a.dm_link ? `${a.dm_message}\n\n${a.dm_link}` : a.dm_message, vars);
  if (branding) msg += '\n\n' + branding;
  return msg;
}

/** The "sent with SocialFlow" line for plans that carry branding, cached per owner for the caller's lifetime. */
export function makeBrandingLine(): (owner: string) => Promise<string | null> {
  const cache = new Map<string, string | null>();
  return async (owner: string) => {
    if (!cache.has(owner)) {
      try {
        const branding = (await getEntitlement(owner)).plan.limits.branding;
        const [pref] = await sql!`SELECT locale FROM owner_prefs WHERE owner_id = ${owner}`;
        cache.set(owner, branding ? getMessages(pref?.locale).server.brandingLine : null);
      } catch { cache.set(owner, null); }
    }
    return cache.get(owner)!;
  };
}

/** Atomic claim of (automation, comment) in processed_comments. Exactly one caller gets true. */
export async function claimComment(automationId: string, commentId: string): Promise<boolean> {
  const rows = await sql!`
    INSERT INTO processed_comments (automation_id, comment_id)
    VALUES (${automationId}, ${commentId}) ON CONFLICT DO NOTHING RETURNING comment_id`;
  return rows.length > 0;
}

export function liveCommentDeps(opts: { pageToken: string; igId: string | null; brandingLine: (owner: string) => Promise<string | null> }): CommentDeps {
  const { pageToken, igId, brandingLine } = opts;
  return {
    claim: claimComment,
    dmAlreadySent: async (automationId, commenterId) =>
      (await sql!`SELECT 1 FROM dm_sent WHERE automation_id = ${automationId} AND commenter_id = ${commenterId} LIMIT 1`).length > 0,
    recordDmSent: async (automationId, commenterId) => {
      await sql!`INSERT INTO dm_sent (automation_id, commenter_id) VALUES (${automationId}, ${commenterId}) ON CONFLICT DO NOTHING`;
    },
    publicReply: (platform, commentId, message) =>
      platform === 'instagram' ? replyToInstagramComment(commentId, message, pageToken) : replyToComment(commentId, message, pageToken),
    privateReply: (platform, commentId, message) =>
      platform === 'instagram' ? sendInstagramPrivateReply(igId || '', commentId, message, pageToken) : sendPrivateReply(commentId, message, pageToken),
    fill: (template, vars) => fillVars(template, vars),
    dmText: async (a, vars) => dmTextFor(a, await brandingLine(a.owner_id), vars),
    bumpTriggerCount: async (automationId) => {
      await sql!`UPDATE automations SET trigger_count = trigger_count + 1 WHERE id = ${automationId}`;
    },
    writeLog: async (r) => {
      const [row] = await sql!`
        INSERT INTO trigger_logs (automation_id, platform, post_id, comment_id,
          commenter_id, commenter_name, comment_text, matched_keyword,
          public_reply_status, dm_status, error_message, dm_message_id, dm_attempts, dm_retryable, source_media_id)
        VALUES (${r.automation_id}, ${r.platform}, ${r.post_id}, ${r.comment_id}, ${r.commenter_id},
          ${r.commenter_name}, ${r.comment_text}, ${r.matched_keyword}, ${r.public_reply_status}, ${r.dm_status}, ${r.error_message},
          ${r.dm_message_id}, ${r.dm_attempts}, ${r.dm_retryable}, ${r.source_media_id})
        RETURNING id`;
      return (row?.id as number | undefined) ?? null;
    },
    openFollowup: (o) => openFollowupConversation(o),
    pace: () => sleep(DM_PACE_MS),
  };
}
