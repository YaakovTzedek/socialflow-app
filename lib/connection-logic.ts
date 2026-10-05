/**
 * The rules behind the "Facebook disconnected" alert, kept free of imports
 * (no database, no fetch) so they can be unit tested with `node --test`.
 * lib/connection.ts applies them inside a row lock.
 *
 * 5.10.2026 (Tolik): the first version alerted once per owner and only cleared
 * the flag on the next login. A partial break (the browser's session token
 * died while the page tokens kept working) set the flag on 3.10 and nothing
 * reached him (no alert email was saved and he has no billing email). When
 * his campaign really stopped on 5.10 the flag was still set from 3.10, so no
 * new alert could go out. Now:
 *   - a break is a disconnect EVENT, opened on the first failure and closed by
 *     a login OR by the poller seeing that owner's tokens work again;
 *   - each event sends one notice (plus one reminder a day later if it is
 *     still open), never one per poll;
 *   - a new event that opens within FLAP_COOLDOWN of the last notice waits, so
 *     a connection that flaps does not mail the owner every few minutes.
 */

export const REMIND_AFTER_MS = 24 * 3600_000;
export const FLAP_COOLDOWN_MS = 6 * 3600_000;
/** First notice + one reminder per disconnect event. */
export const MAX_NOTICES = 2;

export type GraphErrorKind = 'token' | 'permission' | 'missing_object' | 'other';

/**
 * Classify a Graph API error message. Our helpers append "(code X/Y)" to
 * Meta's message, and older call sites only carry the text, so both are read.
 *   token          - code 190 or its wordings: the session/token is dead
 *   permission     - code 10 / 200-299 / "has not authorized": access revoked
 *   missing_object - code 100 subcode 33: the object is gone OR no longer
 *                    visible to us (a deleted post looks the same as a page
 *                    whose access was removed, so the caller decides)
 */
export function classifyGraphError(message: unknown): GraphErrorKind {
  const s = String(message || '');
  if (!s) return 'other';
  if (/\(#190\)|\bcode[":\s]*190\b|session has been invalidated|Error validating access token|access token has expired|session is invalid|Invalid OAuth access token|has not authorized application/i.test(s)) return 'token';
  if (/\(#(10|2\d\d)\)|\bcode[":\s]*(10|2\d\d)\b(?!\d)|permission\(s\) must be granted|does not have permission|requires? (the )?['"]?[a-z_]+['"]? permission|Permissions? error/i.test(s)) return 'permission';
  if (/\bcode[":\s]*100\/33\b|does not exist, cannot be loaded due to missing permissions/i.test(s)) return 'missing_object';
  return 'other';
}

/**
 * Does this error mean the owner must reconnect?
 * `onAccountObject` = the call was on the page / IG account itself (listing its
 * posts or media), where "missing object" means our access is gone, not a post.
 */
export function isConnectionError(message: unknown, onAccountObject = false): boolean {
  const k = classifyGraphError(message);
  return k === 'token' || k === 'permission' || (onAccountObject && k === 'missing_object');
}

export interface AlertRow {
  broken_at: number | null;   // ms epoch, null = connection fine
  notified_at: number | null; // last notice of any event
  notify_count: number;       // notices sent for the CURRENT event
}

export type AlertEvent = { type: 'failure' } | { type: 'healthy' } | { type: 'login' };

export interface AlertDecision {
  row: AlertRow;
  /** 'first' = new disconnect notice, 'reminder' = still disconnected a day later. */
  send: 'first' | 'reminder' | null;
  /** The event opened (true) or closed (false) on this call; undefined = no change. */
  opened?: boolean;
  closed?: boolean;
}

/** One step of the per-owner state machine. Pure. */
export function nextAlertState(prev: AlertRow | null, ev: AlertEvent, now: number): AlertDecision {
  const row: AlertRow = prev ? { ...prev } : { broken_at: null, notified_at: null, notify_count: 0 };
  if (ev.type === 'login' || ev.type === 'healthy') {
    if (row.broken_at == null) return { row, send: null };
    return { row: { ...row, broken_at: null, notify_count: 0 }, send: null, closed: true };
  }
  // failure
  let opened = false;
  if (row.broken_at == null) {
    row.broken_at = now;
    row.notify_count = 0;
    opened = true;
  }
  let send: AlertDecision['send'] = null;
  if (row.notify_count === 0) {
    // A previous event's notice that recent means the connection is flapping: hold back.
    if (row.notified_at == null || now - row.notified_at >= FLAP_COOLDOWN_MS) send = 'first';
  } else if (row.notify_count < MAX_NOTICES && row.notified_at != null && now - row.notified_at >= REMIND_AFTER_MS) {
    send = 'reminder';
  }
  if (send) {
    row.notify_count += 1;
    row.notified_at = now;
  }
  return { row, send, ...(opened ? { opened: true } : {}) };
}

/** Where the alert email goes: the address saved for alerts, then billing, then any address we hold for the owner. */
export function pickAlertEmail(c: { notify_email?: string | null; payer_email?: string | null; affiliate_email?: string | null; login_email?: string | null }): string | null {
  for (const v of [c.notify_email, c.payer_email, c.login_email, c.affiliate_email]) {
    const s = String(v || '').trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return s;
  }
  return null;
}
