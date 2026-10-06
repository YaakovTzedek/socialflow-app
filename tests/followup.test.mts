// Continued DM conversation (follow-up step, 6.10.2026, Tolik): classification parsing, no invented
// text, dedupe, loop prevention, the 24 hour window, echoes, and webhook + poll double delivery.
// Everything runs against an in-memory store; nothing is sent to Meta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeFollowup, parseClassification, decide, handleInbound, newRepliesFromThread, messagingEventsFrom,
  buildClassifierPrompt, activeConfig,
  type FollowupConfig, type Conversation, type FollowupStore, type EngineDeps, type InboundEvent, type StepRecord,
} from '../lib/followup-core.ts';
import { verifyMetaSignature } from '../lib/webhook-signature.ts';
import { createHmac } from 'node:crypto';

const WA = 'https://chat.whatsapp.com/EXAMPLE';
const PRICE = 'המחיר הוא 297 ₪, פרטים: https://example.com/price';

function aiConfig(extra: Record<string, unknown> = {}): FollowupConfig {
  const r = normalizeFollowup({
    mode: 'ai',
    intents: [
      { label: 'thanks', description: 'says thanks or yes, wants the group', reply: `הנה הקבוצה: ${WA}`, keywords: ['תודה'] },
      { label: 'price', description: 'asks about the price', reply: PRICE },
    ],
    fallback: '',
    ...extra,
  });
  assert.ok(r.ok);
  return (r as any).config;
}

/* ---------------- config ---------------- */

test('normalize: clamps caps, requires a message / intents, derives ids', () => {
  const r = normalizeFollowup({ mode: 'simple', message: 'hi', max_followups: 99, window_hours: 500, min_confidence: 7 });
  assert.ok(r.ok);
  const c = (r as any).config as FollowupConfig;
  assert.equal(c.max_followups, 3);
  assert.equal(c.window_hours, 72);
  assert.equal(c.min_confidence, 1);
  assert.deepEqual(normalizeFollowup({ mode: 'simple', message: '' }), { ok: false, error: 'simple_needs_message' });
  assert.deepEqual(normalizeFollowup({ mode: 'ai', intents: [{ label: 'x' }] }), { ok: false, error: 'ai_needs_intents' });
  const ai = aiConfig();
  assert.deepEqual(ai.intents.map((i) => i.id), ['thanks', 'price']);
  // An intent labelled "none" can never collide with the classifier's "none".
  const n = normalizeFollowup({ mode: 'ai', intents: [{ label: 'none', reply: 'a' }, { label: 'None', reply: 'b' }] });
  assert.ok(n.ok);
  const ids = (n as any).config.intents.map((i: any) => i.id);
  assert.ok(!ids.includes('none'));
  assert.equal(new Set(ids).size, 2);
  assert.equal(activeConfig({ enabled: false, mode: 'simple', message: 'x' }), null);
  assert.equal(activeConfig('not json'), null);
});

/* ---------------- classification parsing ---------------- */

test('parseClassification: strict JSON, only configured ids, confidence 0..1', () => {
  const cfg = aiConfig();
  assert.deepEqual(parseClassification('{"intent":"price","confidence":0.9}', cfg), { intentId: 'price', confidence: 0.9, valid: true });
  assert.deepEqual(parseClassification('```json\n{"intent":"thanks","confidence":0.8}\n```', cfg), { intentId: 'thanks', confidence: 0.8, valid: true });
  assert.deepEqual(parseClassification('{"intent":"none","confidence":0.7}', cfg), { intentId: null, confidence: 0.7, valid: true });
  // Unknown id, prose, arrays, out-of-range confidence, extra text -> no intent.
  for (const bad of [
    '{"intent":"discount","confidence":0.99}',
    'The intent is price',
    '[{"intent":"price","confidence":1}]',
    '{"intent":"price","confidence":1.5}',
    '{"intent":"price","confidence":"high"}',
    'Sure! {"intent":"price","confidence":0.9}',
    '',
  ]) assert.equal(parseClassification(bad, cfg).intentId, null, bad);
  assert.equal(parseClassification(undefined as any, cfg).valid, false);
});

test('decide never sends text that was not configured, even if the LLM writes a reply or a link', async () => {
  const cfg = aiConfig({ fallback: 'לא הבנתי, אפשר לפרט?' });
  const configured = new Set([...cfg.intents.map((i) => i.reply), cfg.fallback]);
  const outputs = [
    '{"intent":"price","confidence":0.95,"reply":"Buy now at https://evil.example"}',
    '{"intent":"price","confidence":0.95}\nAlso visit https://evil.example',
    'Here is the link: https://evil.example',
    '{"intent":"https://evil.example","confidence":1}',
  ];
  for (const out of outputs) {
    const d = await decide(cfg, 'כמה זה עולה?', async () => out);
    assert.ok(d.text === null || configured.has(d.text), `unexpected text for ${out}: ${d.text}`);
    assert.ok(!String(d.text).includes('evil'));
  }
  // The classifier never sees the reply texts (it cannot copy or rewrite links).
  const p = buildClassifierPrompt(cfg, 'כמה?');
  assert.ok(!p.system.includes(WA) && !p.system.includes('297'));
});

test('decide: intent keyword wins without the LLM; low confidence -> fallback or nothing', async () => {
  const cfg = aiConfig();
  let called = 0;
  const llm = async () => { called++; return '{"intent":"price","confidence":0.3}'; };
  const kw = await decide(cfg, 'תודה רבה!', llm);
  assert.equal(kw.kind, 'keyword');
  assert.equal(kw.text, `הנה הקבוצה: ${WA}`);
  assert.equal(called, 0);
  const low = await decide(cfg, 'אולי', llm);
  assert.equal(low.kind, 'none');
  assert.equal(low.text, null);
  const withFallback = await decide(aiConfig({ fallback: 'FB' }), 'אולי', llm);
  assert.equal(withFallback.kind, 'fallback');
  assert.equal(withFallback.text, 'FB');
  const high = await decide(cfg, 'מה המחיר', async () => '{"intent":"price","confidence":0.92}');
  assert.equal(high.kind, 'intent');
  assert.equal(high.text, PRICE);
  // LLM down (no key / timeout) -> treated like low confidence.
  const down = await decide(aiConfig({ fallback: 'FB' }), 'מה המחיר', async () => { throw new Error('llm_not_configured'); });
  assert.equal(down.text, 'FB');
  assert.match(String(down.reason), /classify_failed/);
  // Empty reply (a sticker, a reaction) is never answered.
  assert.equal((await decide(cfg, '   ', llm)).text, null);
});

test('decide simple: any reply, or only with a word', async () => {
  const any = (normalizeFollowup({ mode: 'simple', message: `קבוצה: ${WA}` }) as any).config;
  assert.equal((await decide(any, 'כן')).text, `קבוצה: ${WA}`);
  const words = (normalizeFollowup({ mode: 'simple', message: 'M', keywords: ['כן', 'yes'] }) as any).config;
  assert.equal((await decide(words, 'כן בטח')).text, 'M');
  assert.equal((await decide(words, 'לא תודה')).text, null);
});

/* ---------------- engine ---------------- */

const PAGE = 'page1';
const IG = 'ig1';
const PERSON = 'igsid-777';
const T0 = Date.parse('2026-10-06T10:00:00Z');

function memoryWorld(cfg: FollowupConfig | null, convOver: Partial<Conversation> = {}) {
  const conv: Conversation = {
    id: 1, owner_id: 'o1', page_id: PAGE, automation_id: 'a1', recipient_id: PERSON,
    first_dm_at: T0, closes_at: T0 + 48 * 3600_000, followups_sent: 0, stage: 'awaiting', ...convOver,
  };
  const claimed = new Set<string>();
  const records: StepRecord[] = [];
  const sent: { to: string; text: string }[] = [];
  let now = T0 + 10 * 60_000;
  const store: FollowupStore = {
    async openConversations(pageId, rid) { return pageId === conv.page_id && rid === conv.recipient_id && conv.stage === 'awaiting' ? [conv] : []; },
    async claimInbound(_c, ev) { if (claimed.has(ev.mid)) return false; claimed.add(ev.mid); return true; },
    async noteReply() {},
    async claimStep(c, expected, max) {
      // The SQL: UPDATE ... WHERE followups_sent = expected AND followups_sent < max
      if (conv.followups_sent !== expected || conv.followups_sent >= max) return false;
      conv.followups_sent++; return true;
    },
    async record(r) {
      records.push(r);
      if ((r.outcome === 'sent' || r.outcome === 'failed') && cfg && conv.followups_sent >= cfg.max_followups) conv.stage = 'done';
    },
  };
  const deps: EngineDeps = {
    store,
    enabled: () => true,
    now: () => now,
    config: async () => cfg,
    ownIds: async () => new Set([PAGE, IG]),
    send: async (_c, to, text) => { sent.push({ to, text }); return { messageId: `m_out_${sent.length}` }; },
    classify: async () => '{"intent":"price","confidence":0.9}',
  };
  const ev = (mid: string, text: string, over: Partial<InboundEvent> = {}): InboundEvent =>
    ({ pageId: PAGE, senderId: PERSON, mid, text, createdAt: now - 1000, source: 'poll', ...over });
  return { conv, deps, sent, records, ev, setNow: (t: number) => { now = t; } };
}

test('engine: answers a reply once with the configured text', async () => {
  const w = memoryWorld(aiConfig());
  const r = await handleInbound(w.deps, w.ev('in1', 'מה המחיר?'));
  assert.equal(r.outcome, 'sent');
  assert.deepEqual(w.sent, [{ to: PERSON, text: PRICE }]);
  assert.equal(w.conv.followups_sent, 1);
  assert.equal(w.conv.stage, 'done');
});

test('engine: webhook + poll deliver the same message -> exactly one reply', async () => {
  const w = memoryWorld(aiConfig({ max_followups: 3 }));
  const [a, b] = await Promise.all([
    handleInbound(w.deps, w.ev('in1', 'תודה', { source: 'webhook' })),
    handleInbound(w.deps, w.ev('in1', 'תודה', { source: 'poll' })),
  ]);
  assert.deepEqual([a.outcome, b.outcome].sort(), ['duplicate', 'sent']);
  assert.equal(w.sent.length, 1);
  // And again later from the poller: still nothing new.
  assert.equal((await handleInbound(w.deps, w.ev('in1', 'תודה'))).outcome, 'duplicate');
  assert.equal(w.sent.length, 1);
});

test('engine: each step is sent once, and the cap stops the conversation (no loops)', async () => {
  const w = memoryWorld(aiConfig({ max_followups: 2 }));
  const outs: string[] = [];
  for (let i = 1; i <= 6; i++) outs.push((await handleInbound(w.deps, w.ev(`in${i}`, 'מה המחיר?'))).outcome);
  assert.deepEqual(outs.slice(0, 2), ['sent', 'sent']);
  assert.ok(outs.slice(2).every((o) => o === 'no_conversation' || o === 'capped'), outs.join(','));
  assert.equal(w.sent.length, 2);
  assert.deepEqual(w.records.filter((r) => r.outcome === 'sent').map((r) => r.step), [1, 2]);
});

test('engine: a step already claimed by a concurrent run is not sent again', async () => {
  const w = memoryWorld(aiConfig({ max_followups: 1 }));
  // Two different messages racing for the single step.
  const res = await Promise.all([
    handleInbound(w.deps, w.ev('in1', 'מה המחיר?')),
    handleInbound(w.deps, w.ev('in2', 'כמה זה עולה')),
  ]);
  assert.equal(w.sent.length, 1);
  assert.ok(res.some((r) => r.outcome === 'step_taken' || r.outcome === 'capped' || r.outcome === 'no_conversation'));
});

test('engine: our own messages and echoes are never answered', async () => {
  const w = memoryWorld(aiConfig());
  assert.equal((await handleInbound(w.deps, w.ev('e1', 'מה המחיר?', { isEcho: true }))).outcome, 'echo');
  assert.equal((await handleInbound(w.deps, w.ev('e2', 'מה המחיר?', { senderId: IG }))).outcome, 'own_message');
  assert.equal((await handleInbound(w.deps, w.ev('e3', 'מה המחיר?', { senderId: PAGE }))).outcome, 'own_message');
  assert.equal(w.sent.length, 0);
});

test('engine: 24 hour rule and the follow-up window', async () => {
  // A reply written 25 hours ago (found late by the poller) is not answered.
  const w = memoryWorld(aiConfig());
  w.setNow(T0 + 26 * 3600_000);
  const late = await handleInbound(w.deps, w.ev('old1', 'מה המחיר?', { createdAt: T0 + 3600_000 }));
  assert.equal(late.outcome, 'window_closed');
  // After the follow-up window closes, nothing is sent even for a fresh message.
  const w2 = memoryWorld(aiConfig(), { closes_at: T0 + 3600_000 });
  w2.setNow(T0 + 2 * 3600_000);
  assert.equal((await handleInbound(w2.deps, w2.ev('in1', 'מה המחיר?'))).outcome, 'window_closed');
  // A message from before our first DM is not a reply to it.
  const w3 = memoryWorld(aiConfig());
  assert.equal((await handleInbound(w3.deps, w3.ev('pre', 'היי', { createdAt: T0 - 5000 }))).outcome, 'before_first_dm');
  assert.equal(w.sent.length + w2.sent.length + w3.sent.length, 0);
});

test('engine: dormant flag, unknown person, no match', async () => {
  const w = memoryWorld(aiConfig());
  assert.equal((await handleInbound({ ...w.deps, enabled: () => false }, w.ev('x', 'מה המחיר?'))).outcome, 'disabled');
  assert.equal((await handleInbound(w.deps, w.ev('y', 'מה המחיר?', { senderId: 'stranger' }))).outcome, 'no_conversation');
  const w2 = memoryWorld(aiConfig());
  const r = await handleInbound({ ...w2.deps, classify: async () => '{"intent":"none","confidence":0.9}' }, w2.ev('z', 'סתם'));
  assert.equal(r.outcome, 'no_match');
  assert.equal(w2.sent.length, 0);
});

test('engine: a failed send consumes the step (never retried into a double send)', async () => {
  const w = memoryWorld(aiConfig({ max_followups: 1 }));
  const r = await handleInbound({ ...w.deps, send: async () => { throw new Error('HTTP 500'); } }, w.ev('in1', 'מה המחיר?'));
  assert.equal(r.outcome, 'failed');
  assert.equal((await handleInbound(w.deps, w.ev('in2', 'מה המחיר?'))).outcome, 'no_conversation');
  assert.equal(w.sent.length, 0);
});

/* ---------------- polling + webhook parsing ---------------- */

test('newRepliesFromThread: only the person, only after our DM, oldest first', () => {
  const msgs = [
    { id: 'm4', created_time: '2026-10-06T10:20:00+0000', from: { id: IG } },
    { id: 'm3', created_time: '2026-10-06T10:15:00+0000', from: { id: PERSON } },
    { id: 'm2', created_time: '2026-10-06T10:12:00+0000', from: { id: PERSON } },
    { id: 'm1', created_time: '2026-10-06T09:00:00+0000', from: { id: PERSON } },
  ];
  assert.deepEqual(newRepliesFromThread(msgs, PERSON, T0).map((m) => m.id), ['m2', 'm3']);
});

test('messagingEventsFrom: text messages and echoes; reactions and reads skipped', () => {
  const body = { object: 'instagram', entry: [{ id: IG, time: 1, messaging: [
    { sender: { id: PERSON }, recipient: { id: IG }, timestamp: T0, message: { mid: 'mid1', text: 'כן' } },
    { sender: { id: IG }, recipient: { id: PERSON }, timestamp: T0, message: { mid: 'mid2', text: 'x', is_echo: true } },
    { sender: { id: PERSON }, recipient: { id: IG }, timestamp: T0, reaction: { mid: 'mid1', action: 'react' } },
    { sender: { id: PERSON }, recipient: { id: IG }, timestamp: T0, read: { mid: 'mid2' } },
  ] }] };
  const evs = messagingEventsFrom(body);
  assert.equal(evs.length, 2);
  assert.equal(evs[0].text, 'כן');
  assert.equal(evs[1].isEcho, true);
  assert.equal(messagingEventsFrom({ object: 'page', entry: [] }).length, 0);
});

test('verifyMetaSignature: accepts the right HMAC only', () => {
  const raw = JSON.stringify({ object: 'instagram', entry: [] });
  const secret = 'test-secret-not-real';
  const good = 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');
  assert.equal(verifyMetaSignature(raw, good, secret), true);
  assert.equal(verifyMetaSignature(raw + ' ', good, secret), false);
  assert.equal(verifyMetaSignature(raw, good, 'other'), false);
  assert.equal(verifyMetaSignature(raw, null, secret), false);
  assert.equal(verifyMetaSignature(raw, good, ''), false);
  assert.equal(verifyMetaSignature(raw, 'sha256=zz', secret), false);
});
