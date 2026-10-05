// Comments on sponsored (ad) copies of an Instagram post (5.10.2026, Tolik): merge + dedupe + labels,
// against a mocked Graph API.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeComments, collectComments, fetchAdChecks, resolveAdMedia, parseBoostAdsList,
  sponsoredCommentCount, hasAdSurfaces, type IgComment, type GraphGet,
} from '../lib/ad-comments.ts';

const REEL = '18065323955786459';
const AD_MEDIA = '18100000000000001';
const c = (id: string, ts: string, text = 'hi'): IgComment => ({ id, text, username: 'u' + id, timestamp: ts });

/** A tiny fake Graph: routes by path, records calls, throws Meta-shaped errors. */
function fakeGraph(routes: Record<string, (p: Record<string, string>) => any>) {
  const calls: Array<{ path: string; params: Record<string, string> }> = [];
  const get: GraphGet = async (path, params) => {
    calls.push({ path, params });
    const h = routes[path];
    if (!h) throw new Error(`Unsupported get request (code 100/33)`);
    const out = h(params);
    if (out instanceof Error) throw out;
    return out;
  };
  return { get, calls };
}

test('organic + sponsored are merged, deduplicated by id, labelled, newest first', () => {
  const organic = [c('1', '2026-10-05T10:00:00Z'), c('2', '2026-10-05T11:00:00Z')];
  const ad = [c('2', '2026-10-05T11:00:00Z'), c('3', '2026-10-05T12:00:00Z'), c('3', '2026-10-05T12:00:00Z'), c('4', '2026-10-05T09:00:00Z')];
  const out = mergeComments(REEL, organic, [{ ad_media_id: AD_MEDIA, ad_id: 'ad1', comments: ad }]);
  assert.deepEqual(out.map((x) => x.id), ['3', '2', '1', '4']);
  assert.equal(out.find((x) => x.id === '2')!.sponsored, false, 'an id seen on the post stays organic');
  assert.equal(out.find((x) => x.id === '3')!.sponsored, true);
  assert.equal(out.find((x) => x.id === '3')!.source_media_id, AD_MEDIA);
  assert.equal(out.find((x) => x.id === '3')!.ad_id, 'ad1');
  assert.equal(out.filter((x) => x.sponsored).length, 2);
});

test('the same ad media linked twice, or equal to the post, is read once', () => {
  const out = mergeComments(REEL, [], [
    { ad_media_id: AD_MEDIA, comments: [c('5', '2026-10-05T10:00:00Z')] },
    { ad_media_id: AD_MEDIA, comments: [c('5', '2026-10-05T10:00:00Z'), c('6', '2026-10-05T10:01:00Z')] },
    { ad_media_id: REEL, comments: [c('7', '2026-10-05T10:02:00Z')] },
  ]);
  assert.deepEqual(out.map((x) => x.id), ['5']);
});

test("Tolik's reel: 0 organic comments, 5 on the ad copy -> all 5 found and marked sponsored", async () => {
  const five = ['a', 'b', 'c', 'd', 'e'].map((id, i) => c(id, `2026-10-05T1${i}:00:00Z`));
  const { get, calls } = fakeGraph({
    [`${REEL}/comments`]: () => ({ data: [] }),
    [`${AD_MEDIA}/comments`]: () => ({ data: five }),
  });
  const list = async (id: string) => (await get(`${id}/comments`, { fields: 'id,text' })).data;
  const r = await collectComments(REEL, [{ ad_media_id: AD_MEDIA, ad_id: 'ad1' }], list);
  assert.equal(r.comments.length, 5);
  assert.ok(r.comments.every((x) => x.sponsored && x.source_media_id === AD_MEDIA));
  assert.equal(r.ad_errors.length, 0);
  assert.equal(calls.length, 2);
});

test('an ad media that errors does not hide the organic comments; an organic error still throws', async () => {
  const { get } = fakeGraph({ [`${REEL}/comments`]: () => ({ data: [c('1', '2026-10-05T10:00:00Z')] }) });
  const list = async (id: string) => (await get(`${id}/comments`, {})).data;
  const r = await collectComments(REEL, [{ ad_media_id: AD_MEDIA }], list);
  assert.equal(r.comments.length, 1);
  assert.equal(r.ad_errors.length, 1);
  const broken = fakeGraph({});
  await assert.rejects(collectComments(REEL, [], async (id) => (await broken.get(`${id}/comments`, {})).data));
});

test('fetchAdChecks: one batched call, counts and ad ids parsed', async () => {
  const { get, calls } = fakeGraph({
    '': (p) => {
      assert.ok(p.fields.includes('boost_ads_list'));
      return {
        [REEL]: { id: REEL, comments_count: 0, total_comments_count: 5, boost_ads_list: { data: [{ ad_id: 'ad1', ad_status: 'ACTIVE' }] } },
        '999': { id: '999', comments_count: 3, total_comments_count: 3 },
      };
    },
  });
  const r = await fetchAdChecks([REEL, '999', REEL], 'tok', get);
  assert.equal(calls.length, 1);
  assert.deepEqual(r[REEL], { organic_comments: 0, total_comments: 5, ad_ids: ['ad1'], unsupported: false });
  assert.equal(sponsoredCommentCount(r[REEL]), 5);
  assert.equal(hasAdSurfaces(r[REEL]), true);
  assert.equal(sponsoredCommentCount(r['999']), 0);
  assert.equal(hasAdSurfaces(r['999']), false);
});

test('fetchAdChecks steps down when the Graph version refuses total_comments_count, and never throws', async () => {
  const { get, calls } = fakeGraph({
    '': (p) => p.fields.includes('total_comments_count')
      ? new Error('(#100) Tried accessing nonexisting field (total_comments_count) (code 100)')
      : { [REEL]: { comments_count: 0, boost_ads_list: [{ ad_id: 'ad1' }] } },
  });
  const r = await fetchAdChecks([REEL], 'tok', get);
  assert.equal(calls.length, 2);
  assert.deepEqual(r[REEL].ad_ids, ['ad1']);
  assert.equal(r[REEL].total_comments, null);
  const dead = fakeGraph({ '': () => new Error('boom') });
  const r2 = await fetchAdChecks([REEL], 'tok', dead.get);
  assert.equal(r2[REEL].unsupported, true);
});

test('resolveAdMedia: effective_instagram_media_id with ads_read; a permission error is reported, not thrown', async () => {
  const ok = fakeGraph({ ad1: () => ({ id: 'ad1', creative: { id: 'cr', effective_instagram_media_id: AD_MEDIA } }) });
  assert.deepEqual(await resolveAdMedia('ad1', 'tok', ok.get), { ad_media_id: AD_MEDIA, permission_missing: false });
  const denied = fakeGraph({ ad1: () => new Error('(#200) Requires ads_management or ads_read permission (code 200)') });
  const r = await resolveAdMedia('ad1', 'tok', denied.get);
  assert.equal(r.ad_media_id, null);
  assert.equal(r.permission_missing, true);
});

test('parseBoostAdsList tolerates both shapes and duplicates', () => {
  assert.deepEqual(parseBoostAdsList([{ ad_id: '1', ad_status: 'ACTIVE' }, { ad_id: '1' }, { id: '2', status: 'PAUSED' }]),
    [{ ad_id: '1', ad_status: 'ACTIVE' }, { ad_id: '2', ad_status: 'PAUSED' }]);
  assert.deepEqual(parseBoostAdsList(undefined), []);
});
