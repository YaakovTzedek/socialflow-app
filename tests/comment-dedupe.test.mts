// One comment, two paths (6.10.2026): the Meta webhook and the poller both answer comments, and both go through
// lib/comment-core.ts, which claims the comment in processed_comments before any reply or DM. Whichever path sees
// a comment first answers it; the other skips. Everything runs against an in-memory store; nothing is sent to Meta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  handleMatchedComment, extractCommentEvents, webhookMatches,
  type CommentDeps, type MatchedComment, type TriggerLogRow, type Platform,
} from '../lib/comment-core.ts';

const PAGE = '111';
const IG = '17841400000000000';

function world() {
  const processed = new Set<string>();
  const dmSent = new Set<string>();
  const publicReplies: Array<{ platform: Platform; commentId: string; message: string }> = [];
  const dms: Array<{ platform: Platform; commentId: string; message: string }> = [];
  const logs: TriggerLogRow[] = [];
  const counts = new Map<string, number>();
  const followups: any[] = [];
  const tick = () => new Promise<void>((r) => setImmediate(r));
  const deps: CommentDeps = {
    // Same semantics as INSERT ... ON CONFLICT DO NOTHING RETURNING: the check and the insert are one step.
    claim: async (aid, cid) => {
      await tick();
      const k = `${aid}|${cid}`;
      if (processed.has(k)) return false;
      processed.add(k);
      return true;
    },
    dmAlreadySent: async (aid, who) => { await tick(); return dmSent.has(`${aid}|${who}`); },
    recordDmSent: async (aid, who) => { dmSent.add(`${aid}|${who}`); },
    publicReply: async (platform, commentId, message) => { await tick(); publicReplies.push({ platform, commentId, message }); return { id: 'r' }; },
    privateReply: async (platform, commentId, message) => { await tick(); dms.push({ platform, commentId, message }); return { messageId: `m_${dms.length}`, recipientId: 'psid' }; },
    fill: (t, v) => t.split('{name}').join(v.name || ''),
    dmText: async (a, v) => `${a.dm_message} ${v.name || ''}`.trim(),
    bumpTriggerCount: async (aid) => { counts.set(aid, (counts.get(aid) || 0) + 1); },
    writeLog: async (row) => { logs.push(row); return logs.length; },
    openFollowup: async (o) => { followups.push(o); },
    pace: async () => {},
    random: () => 0,
  };
  return { deps, processed, dmSent, publicReplies, dms, logs, counts, followups };
}

function automation(platform: Platform, extra: Record<string, unknown> = {}) {
  return {
    id: `auto-${platform}`, owner_id: 'owner-1', page_id: PAGE, platform, status: 'active', post_scope: 'all_posts',
    keywords: ['info'], match_type: 'contains', public_reply_enabled: true, public_replies: ['Sent you a DM {name}'],
    dm_enabled: true, dm_message: 'Here is the link', dm_link: null, once_per_user: false,
    created_at: '2026-10-01T00:00:00Z', ...extra,
  };
}

function fbWebhookBody(commentId: string) {
  return {
    object: 'page',
    entry: [{ id: PAGE, changes: [{ field: 'feed', value: {
      item: 'comment', verb: 'add', comment_id: commentId, post_id: `${PAGE}_900`, message: 'info please',
      from: { id: '555', name: 'Dana' },
    } }] }],
  };
}

function igWebhookBody(commentId: string, media: Record<string, unknown> = { id: 'media-1' }) {
  return {
    object: 'instagram',
    entry: [{ id: IG, changes: [{ field: 'comments', value: {
      id: commentId, text: 'INFO', media, from: { id: '9001', username: 'dana.ig' },
    } }] }],
  };
}

/** The webhook path: delivery -> events -> automations it hits -> shared handler. */
async function runWebhook(body: any, autos: any[], deps: CommentDeps) {
  const out = [];
  for (const ev of extractCommentEvents(body)) {
    for (const m of webhookMatches(ev, autos, { pageId: PAGE, igId: IG, pageName: 'My Page' })) {
      out.push(await handleMatchedComment(m.automation, m.comment, deps));
    }
  }
  return out;
}

/** The poller path, with the comment shaped the way the poller reads it (IG commenter = username). */
function runPoller(a: any, platform: Platform, commentId: string, deps: CommentDeps) {
  const c: MatchedComment = platform === 'facebook'
    ? { commentId, postId: `${PAGE}_900`, text: 'info please', commenterId: '555', commenterName: 'Dana', keyword: 'info', pageName: 'My Page' }
    : { commentId, postId: 'media-1', text: 'INFO', commenterId: 'dana.ig', commenterName: 'dana.ig', keyword: 'info', pageName: 'My Page' };
  return handleMatchedComment(a, c, deps);
}

function assertAnsweredOnce(w: ReturnType<typeof world>, platform: Platform, commentId: string) {
  assert.equal(w.publicReplies.length, 1, 'exactly one public reply');
  assert.equal(w.dms.length, 1, 'exactly one DM');
  assert.equal(w.publicReplies[0].platform, platform);
  assert.equal(w.dms[0].platform, platform);
  assert.equal(w.publicReplies[0].commentId, commentId);
  assert.equal(w.dms[0].commentId, commentId);
  assert.equal(w.logs.length, 1, 'one trigger_logs row');
  assert.equal(w.logs[0].public_reply_status, 'sent');
  assert.equal(w.logs[0].dm_status, 'sent');
  assert.equal([...w.counts.values()].reduce((x, y) => x + y, 0), 1, 'trigger_count bumped once');
}

for (const platform of ['facebook', 'instagram'] as const) {
  const body = (id: string) => (platform === 'facebook' ? fbWebhookBody(id) : igWebhookBody(id));

  test(`${platform}: webhook then poller -> one reply, one DM`, async () => {
    const w = world();
    const a = automation(platform);
    const [first] = await runWebhook(body('c1'), [a], w.deps);
    assert.equal(first.claimed, true);
    const second = await runPoller(a, platform, 'c1', w.deps);
    assert.equal(second.claimed, false);
    assertAnsweredOnce(w, platform, 'c1');
  });

  test(`${platform}: poller then webhook -> one reply, one DM`, async () => {
    const w = world();
    const a = automation(platform);
    const first = await runPoller(a, platform, 'c2', w.deps);
    assert.equal(first.claimed, true);
    const second = await runWebhook(body('c2'), [a], w.deps);
    assert.deepEqual(second.map((o) => o.claimed), [false]);
    assertAnsweredOnce(w, platform, 'c2');
  });

  test(`${platform}: webhook and poller at the same moment -> one winner`, async () => {
    const w = world();
    const a = automation(platform);
    const results = await Promise.all([runWebhook(body('c3'), [a], w.deps).then((r) => r[0]), runPoller(a, platform, 'c3', w.deps)]);
    assert.equal(results.filter((r) => r.claimed).length, 1);
    assertAnsweredOnce(w, platform, 'c3');
  });
}

test('concurrent claims: 20 callers on one comment -> exactly one sends', async () => {
  const w = world();
  const a = automation('facebook');
  const results = await Promise.all(Array.from({ length: 20 }, (_, i) =>
    i % 2 ? runPoller(a, 'facebook', 'c4', w.deps) : runWebhook(fbWebhookBody('c4'), [a], w.deps).then((r) => r[0])));
  assert.equal(results.filter((r) => r.claimed).length, 1);
  assertAnsweredOnce(w, 'facebook', 'c4');
});

test('instagram via webhook: reply goes through the IG path, a DM is sent, commenter keyed by username', async () => {
  const w = world();
  await runWebhook(igWebhookBody('c5'), [automation('instagram')], w.deps);
  assert.equal(w.publicReplies[0].platform, 'instagram');
  assert.equal(w.publicReplies[0].message, 'Sent you a DM dana.ig');
  assert.equal(w.dms.length, 1);
  assert.equal(w.logs[0].commenter_id, 'dana.ig');
  assert.ok(w.dmSent.has('auto-instagram|dana.ig'));
});

test('once_per_user is shared between the paths (a second comment by the same person gets no second DM)', async () => {
  const w = world();
  const a = automation('instagram', { once_per_user: true });
  await runWebhook(igWebhookBody('c6'), [a], w.deps);
  await runPoller(a, 'instagram', 'c7', w.deps);
  assert.equal(w.dms.length, 1);
  assert.equal(w.logs[1].dm_status, 'skipped_duplicate');
});

test('webhook skips our own comments, story/inbox automations and non-matching keywords', () => {
  const own = extractCommentEvents({ object: 'page', entry: [{ id: PAGE, changes: [{ field: 'feed', value: { item: 'comment', verb: 'add', comment_id: 'x', post_id: 'p', message: 'info', from: { id: PAGE } } }] }] });
  assert.equal(webhookMatches(own[0], [automation('facebook')], { pageId: PAGE }).length, 0);
  const [ev] = extractCommentEvents(fbWebhookBody('c8'));
  assert.equal(webhookMatches(ev, [automation('facebook', { post_scope: 'story_replies' })], { pageId: PAGE }).length, 0);
  assert.equal(webhookMatches(ev, [automation('facebook', { keywords: ['price'] })], { pageId: PAGE }).length, 0);
  assert.equal(webhookMatches(ev, [automation('instagram')], { pageId: PAGE }).length, 0);
});

test('webhook: IG comment on an ad copy counts for the organic post, unless the ad media has its own automation', () => {
  const [ev] = extractCommentEvents(igWebhookBody('c9', { id: 'ad-media', original_media_id: 'organic', ad_id: 'ad1' }));
  const onPost = automation('instagram', { id: 'post-auto', post_scope: 'specific_post', post_id: 'organic' });
  const m = webhookMatches(ev, [onPost], { pageId: PAGE, igId: IG });
  assert.equal(m.length, 1);
  assert.equal(m[0].comment.postId, 'organic');
  assert.equal(m[0].comment.sourceMediaId, 'ad-media');
  const onAd = automation('instagram', { id: 'ad-auto', post_scope: 'specific_post', post_id: 'ad-media' });
  const m2 = webhookMatches(ev, [onPost, onAd], { pageId: PAGE, igId: IG });
  assert.deepEqual(m2.map((x) => x.automation.id), ['ad-auto']);
});
