// Disconnect alerts: one notice per disconnect event, never one per poll (5.10.2026, Tolik).
// Run: npm test   (node --test, native TypeScript stripping)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nextAlertState, classifyGraphError, isConnectionError, pickAlertEmail,
  REMIND_AFTER_MS, FLAP_COOLDOWN_MS, type AlertRow, type AlertEvent,
} from '../lib/connection-logic.ts';

const MIN = 60_000;
const H = 3600_000;

/** Drive the state machine like the poller does and count what would be sent. */
function run(events: Array<[number, AlertEvent['type']]>) {
  let row: AlertRow | null = null;
  const sent: Array<{ at: number; kind: string }> = [];
  for (const [at, type] of events) {
    const d = nextAlertState(row, { type } as AlertEvent, at);
    row = d.row;
    if (d.send) sent.push({ at, kind: d.send });
  }
  return { row, sent };
}

test('a break seen by every 2-minute poll for 3 hours sends ONE notice', () => {
  const events: Array<[number, 'failure']> = [];
  for (let t = 0; t <= 3 * H; t += 2 * MIN) events.push([t, 'failure']);
  const { sent, row } = run(events);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].kind, 'first');
  assert.equal(row!.notify_count, 1);
});

test('still broken a day later: exactly one reminder, then silence', () => {
  const events: Array<[number, 'failure']> = [];
  for (let t = 0; t <= 3 * 24 * H; t += 10 * MIN) events.push([t, 'failure']);
  const { sent } = run(events);
  assert.deepEqual(sent.map((s) => s.kind), ['first', 'reminder']);
  assert.ok(sent[1].at - sent[0].at >= REMIND_AFTER_MS);
});

test('two pollers reporting the same failure at the same instant send once (row is locked, second sees count=1)', () => {
  const { sent } = run([[1000, 'failure'], [1000, 'failure']]);
  assert.equal(sent.length, 1);
});

test('stale flag no longer swallows a later real break (the 3.10 -> 5.10 case)', () => {
  // 3.10 23:47 break flagged; 4.10 the poller reads every page fine -> healthy closes it;
  // 5.10 10:00 a real break -> a NEW event -> a new notice.
  const t0 = 0;
  const { sent, row } = run([
    [t0, 'failure'],
    [t0 + 20 * H, 'healthy'],
    [t0 + 34 * H, 'failure'],
    [t0 + 34 * H + 2 * MIN, 'failure'],
  ]);
  assert.deepEqual(sent.map((s) => s.kind), ['first', 'first']);
  assert.equal(row!.notify_count, 1);
});

test('login closes the event; the next break alerts again', () => {
  const { sent } = run([[0, 'failure'], [H, 'login'], [10 * H, 'failure']]);
  assert.equal(sent.length, 2);
});

test('a flapping connection (break/heal every few minutes) is held to one notice per cooldown', () => {
  const events: Array<[number, AlertEvent['type']]> = [];
  for (let t = 0; t < 5 * H; t += 4 * MIN) events.push([t, 'failure'], [t + 2 * MIN, 'healthy']);
  const { sent } = run(events);
  assert.equal(sent.length, 1);
  // ...and once the cooldown has passed, a new event may notify again.
  const later = run([...events, [FLAP_COOLDOWN_MS + H, 'failure']]);
  assert.equal(later.sent.length, 2);
});

test('healthy/login on a fine connection changes nothing', () => {
  const d = nextAlertState(null, { type: 'healthy' }, 0);
  assert.equal(d.send, null);
  assert.equal(d.row.broken_at, null);
  assert.equal(d.closed, undefined);
});

test('classifyGraphError', () => {
  assert.equal(classifyGraphError('Error validating access token: The session has been invalidated because the user changed their password (code 190/460)'), 'token');
  assert.equal(classifyGraphError('Invalid OAuth access token - Cannot parse access token (code 190)'), 'token');
  assert.equal(classifyGraphError('(#10) Application does not have permission for this action (code 10)'), 'permission');
  assert.equal(classifyGraphError('(#200) Requires pages_read_engagement permission (code 200)'), 'permission');
  assert.equal(classifyGraphError("Unsupported get request. Object with ID '178' does not exist, cannot be loaded due to missing permissions, or does not support this operation (code 100/33)"), 'missing_object');
  // DM / reply failures and rate limits are not disconnections
  assert.equal(classifyGraphError('HTTP 400: (#-1) The comment you are trying to reply to, already has a reply. (code -1/2534023)'), 'other');
  assert.equal(classifyGraphError('HTTP 400: (#100) The thread owner has archived or deleted this conversation (code 100/2534001)'), 'other');
  assert.equal(classifyGraphError('(#4) Application request limit reached (code 4)'), 'other');
  assert.equal(classifyGraphError('(#17) User request limit reached (code 17)'), 'other');
});

test('isConnectionError: a missing object only counts on the account itself (a deleted post is not a disconnect)', () => {
  const missing = 'Object with ID x does not exist, cannot be loaded due to missing permissions (code 100/33)';
  assert.equal(isConnectionError(missing), false);
  assert.equal(isConnectionError(missing, true), true);
  assert.equal(isConnectionError('(code 190/463) access token has expired'), true);
});

test('pickAlertEmail falls back from the saved address to billing, login, partner', () => {
  assert.equal(pickAlertEmail({ notify_email: 'a@x.co', payer_email: 'b@x.co' }), 'a@x.co');
  assert.equal(pickAlertEmail({ notify_email: '', payer_email: null, login_email: 'c@x.co', affiliate_email: 'd@x.co' }), 'c@x.co');
  assert.equal(pickAlertEmail({ affiliate_email: 'd@x.co' }), 'd@x.co');
  assert.equal(pickAlertEmail({ notify_email: 'not an email' }), null);
});
