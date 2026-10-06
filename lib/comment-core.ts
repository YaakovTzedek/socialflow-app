/**
 * Answering one comment for one automation: the single code path shared by the poller
 * (app/api/cron/poll) and the Meta webhook (app/api/webhooks/meta), 6.10.2026.
 *
 * Until then the webhook had its own copy of this logic. It never claimed the comment in
 * processed_comments, so once comment webhooks were wired (30.9) a Facebook comment could be
 * answered twice: once by the webhook and again by the poller a few minutes later. It also used
 * the wrong Instagram reply endpoint and sent no Instagram DM at all.
 *
 * Now both paths call handleMatchedComment(), which CLAIMS the comment first
 * (INSERT ... ON CONFLICT DO NOTHING on processed_comments (automation_id, comment_id)) and only the
 * caller that inserted the row sends anything. Whoever sees the comment first answers it; the other
 * gets no row back and skips.
 *
 * Like lib/followup-core.ts this file has no imports, so `node --test` runs it against an in-memory
 * store. lib/comment-handler.ts wires it to Postgres and the Graph API.
 */

export type Platform = 'facebook' | 'instagram';

export interface TemplateVarsLite { name?: string | null; keyword?: string | null; page?: string | null }

export interface CommentAutomation {
  id: string;
  owner_id: string;
  page_id: string;
  platform: Platform | string;
  public_reply_enabled?: boolean | null;
  public_replies?: string[] | null;
  dm_enabled?: boolean | null;
  dm_message?: string | null;
  dm_link?: string | null;
  once_per_user?: boolean | null;
  [k: string]: unknown;
}

export interface MatchedComment {
  commentId: string;
  /** The post the comment belongs to (for a comment on an ad copy: the organic post it promotes). */
  postId: string;
  text: string;
  /** The commenter as dm_sent knows them: the FB user id, or the IG username (what the poller reads). */
  commenterId: string;
  commenterName: string;
  keyword: string | null;
  /** The ad media the comment lives on, when it is not the post itself. */
  sourceMediaId?: string | null;
  pageName?: string | null;
}

export interface TriggerLogRow {
  automation_id: string;
  platform: string;
  post_id: string;
  comment_id: string;
  commenter_id: string;
  commenter_name: string;
  comment_text: string;
  matched_keyword: string | null;
  public_reply_status: string;
  dm_status: string;
  error_message: string | null;
  dm_message_id: string | null;
  dm_attempts: number;
  dm_retryable: boolean;
  source_media_id: string | null;
}

export interface CommentDeps {
  /** Atomic: true only for the one caller that inserted (automation_id, comment_id). */
  claim(automationId: string, commentId: string): Promise<boolean>;
  dmAlreadySent(automationId: string, commenterId: string): Promise<boolean>;
  recordDmSent(automationId: string, commenterId: string): Promise<void>;
  /** Public reply under the comment (FB: {comment}/comments, IG: {comment}/replies). */
  publicReply(platform: Platform, commentId: string, message: string): Promise<unknown>;
  /** Private reply (DM) to the comment's author. */
  privateReply(platform: Platform, commentId: string, message: string): Promise<{ messageId: string; recipientId?: string }>;
  fill(template: string, vars: TemplateVarsLite): string;
  /** The full DM text (template filled, link and plan branding appended). */
  dmText(a: CommentAutomation, vars: TemplateVarsLite): Promise<string>;
  bumpTriggerCount(automationId: string): Promise<void>;
  writeLog(row: TriggerLogRow): Promise<number | string | null>;
  openFollowup(opts: { automation: CommentAutomation; recipientId: string | null; recipientName: string | null; firstDmMid: string | null; logId: number | string | null }): Promise<void>;
  /** Pause after a DM attempt (Meta allows about two calls a second per account). */
  pace(): Promise<void>;
  random?: () => number;
}

export type CommentOutcome =
  | { claimed: false }
  | { claimed: true; publicStatus: string; dmStatus: string; error: string | null; dmMessageId: string | null; logId: number | string | null };

export async function handleMatchedComment(a: CommentAutomation, c: MatchedComment, deps: CommentDeps): Promise<CommentOutcome> {
  if (!c.commentId) return { claimed: false };
  // Claim before sending anything: a concurrent poller or webhook that reaches the same comment gets no row back.
  if (!(await deps.claim(String(a.id), c.commentId))) return { claimed: false };

  const platform: Platform = a.platform === 'instagram' ? 'instagram' : 'facebook';
  const vars: TemplateVarsLite = { name: c.commenterName, keyword: c.keyword, page: c.pageName ?? null };
  const rnd = deps.random || Math.random;

  let publicStatus = 'skipped';
  let dmStatus = 'skipped';
  let err: string | null = null;

  const replies = Array.isArray(a.public_replies) ? a.public_replies : [];
  if (a.public_reply_enabled && replies.length > 0) {
    try {
      const reply = deps.fill(replies[Math.floor(rnd() * replies.length)] || '', vars);
      if (reply?.trim()) {
        await deps.publicReply(platform, c.commentId, reply);
        publicStatus = 'sent';
      }
    } catch (e: any) {
      publicStatus = 'failed';
      err = e?.message || String(e);
    }
  }

  let dmMessageId: string | null = null;
  let dmRecipient: string | null = null;
  let dmRetryable = false;
  if (a.dm_enabled && a.dm_message) {
    // once_per_user is honoured against dm_sent, so a person who already got this automation's message is not messaged twice.
    const already = a.once_per_user && c.commenterId ? await deps.dmAlreadySent(String(a.id), c.commenterId) : false;
    if (already) {
      dmStatus = 'skipped_duplicate';
    } else {
      const msg = await deps.dmText(a, vars);
      try {
        const sent = await deps.privateReply(platform, c.commentId, msg);
        dmStatus = 'sent';
        dmMessageId = sent.messageId;
        dmRecipient = sent.recipientId || null;
        if (c.commenterId) await deps.recordDmSent(String(a.id), c.commenterId);
      } catch (e: any) {
        dmStatus = 'failed';
        dmRetryable = e?.retryable !== false;
        err = err || e?.message || String(e);
      }
      await deps.pace();
    }
  }

  await deps.bumpTriggerCount(String(a.id));
  const logId = await deps.writeLog({
    automation_id: String(a.id), platform, post_id: c.postId, comment_id: c.commentId,
    commenter_id: c.commenterId || '', commenter_name: c.commenterName || '', comment_text: c.text,
    matched_keyword: c.keyword, public_reply_status: publicStatus, dm_status: dmStatus, error_message: err,
    dm_message_id: dmMessageId, dm_attempts: dmStatus === 'skipped_duplicate' ? 0 : 1, dm_retryable: dmRetryable,
    source_media_id: c.sourceMediaId || null,
  });
  if (dmStatus === 'sent') {
    await deps.openFollowup({ automation: a, recipientId: dmRecipient, recipientName: c.commenterName || null, firstDmMid: dmMessageId, logId });
  }
  return { claimed: true, publicStatus, dmStatus, error: err, dmMessageId, logId };
}

// ---------------------------------------------------------------------------------------------
// Webhook side: turning a Meta delivery into comment events and picking the automations they hit.
// ---------------------------------------------------------------------------------------------

export interface CommentEvent {
  platform: Platform;
  /** entry.id: the page id (FB) or the IG business account id (IG). */
  pageOrIgId: string;
  commentId: string;
  /** The media/post the comment lives on (for IG an ad copy has its own media id). */
  postId: string;
  /** Instagram comment on an ad copy: the organic post it promotes (Meta sends media.original_media_id). */
  originalPostId?: string;
  adId?: string;
  text: string;
  /** Numeric user id of the author. */
  fromId: string;
  /** FB: display name; IG: username. */
  fromName: string;
}

export function extractCommentEvents(body: any): CommentEvent[] {
  const events: CommentEvent[] = [];
  if (!body?.entry || !Array.isArray(body.entry)) return events;
  for (const entry of body.entry) {
    for (const change of entry?.changes || []) {
      const v = change?.value || {};
      if (body.object === 'page' && change.field === 'feed' && v.item === 'comment' && v.verb === 'add') {
        events.push({
          platform: 'facebook',
          pageOrIgId: String(entry.id || ''),
          commentId: String(v.comment_id || ''),
          postId: String(v.post_id || ''),
          text: v.message || '',
          fromId: String(v.from?.id || ''),
          fromName: v.from?.name || '',
        });
      }
      if (body.object === 'instagram' && change.field === 'comments') {
        events.push({
          platform: 'instagram',
          pageOrIgId: String(entry.id || ''),
          commentId: String(v.id || ''),
          postId: String(v.media?.id || ''),
          originalPostId: v.media?.original_media_id ? String(v.media.original_media_id) : undefined,
          adId: v.media?.ad_id ? String(v.media.ad_id) : undefined,
          text: v.text || '',
          fromId: String(v.from?.id || ''),
          fromName: v.from?.username || '',
        });
      }
    }
  }
  return events;
}

export function keywordMatch(text: string, keywords: string[], matchType: string): string | null {
  const t = (text || '').toLowerCase();
  for (const kw of keywords) {
    const k = (kw || '').toLowerCase().trim();
    if (!k) continue;
    if (matchType === 'exact' ? t === k : t.includes(k)) return kw;
  }
  return null;
}

/**
 * The automations a webhook comment event triggers, with the MatchedComment to hand to
 * handleMatchedComment(). Same rules as the poller: comment automations only, post scope (a comment
 * on an ad copy counts for the organic post, unless the ad media has its own automation, which then
 * answers it alone), keywords, never our own comments, and only comments newer than the automation.
 */
export function webhookMatches(
  ev: CommentEvent,
  automations: any[],
  ctx: { pageId: string; igId?: string | null; pageName?: string | null; ourIgUsername?: string | null; now?: number },
): Array<{ automation: any; comment: MatchedComment }> {
  const out: Array<{ automation: any; comment: MatchedComment }> = [];
  if (!ev.commentId || !ev.text) return out;
  // Never answer ourselves.
  if (ev.fromId && (ev.fromId === ctx.pageId || (ctx.igId && ev.fromId === ctx.igId))) return out;
  if (ev.platform === 'instagram' && ctx.ourIgUsername && ev.fromName.toLowerCase() === ctx.ourIgUsername.toLowerCase()) return out;

  const onAdCopy = !!ev.originalPostId && ev.originalPostId !== ev.postId;
  const organicPost = onAdCopy ? ev.originalPostId! : ev.postId;
  const commentAutos = automations.filter(
    (a) => a.status === 'active' && a.platform === ev.platform && a.post_scope !== 'story_replies' && a.post_scope !== 'dm_inbound',
  );
  // The poller leaves ad media that have their own automation to that automation; so does the webhook.
  const adCopyHasOwn = onAdCopy && commentAutos.some((a) => a.post_scope === 'specific_post' && a.post_id === ev.postId);

  for (const a of commentAutos) {
    if (a.post_scope === 'specific_post' && a.post_id) {
      if (a.post_id === ev.postId) { /* direct hit */ }
      else if (onAdCopy && a.post_id === ev.originalPostId && !adCopyHasOwn) { /* comment on the post's ad copy */ }
      else continue;
    } else if (onAdCopy && adCopyHasOwn) {
      continue;
    }
    let kw: string | null = null;
    if (Array.isArray(a.keywords) && a.keywords.length > 0) {
      kw = keywordMatch(ev.text, a.keywords, a.match_type);
      if (!kw) continue;
    }
    // A webhook arrives seconds after the comment, so "now" stands in for the comment time.
    if (a.created_at && (ctx.now ?? Date.now()) < Date.parse(a.created_at)) continue;
    const isDirectAdMedia = a.post_scope === 'specific_post' && a.post_id === ev.postId;
    out.push({
      automation: a,
      comment: {
        commentId: ev.commentId,
        postId: isDirectAdMedia ? ev.postId : organicPost,
        text: ev.text,
        // The poller keys Instagram commenters by username (that is what the comments edge returns), so dm_sent
        // and once_per_user see the same person whichever path answers.
        commenterId: ev.platform === 'instagram' ? (ev.fromName || ev.fromId) : ev.fromId,
        commenterName: ev.fromName,
        keyword: kw,
        sourceMediaId: onAdCopy && !isDirectAdMedia ? ev.postId : null,
        pageName: ctx.pageName ?? null,
      },
    });
  }
  return out;
}
