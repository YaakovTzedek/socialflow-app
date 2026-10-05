import { sql, hasDb, ensureSchema } from './db';
import { emailConfigured, emailShell, sendEmail } from './email';
import { graphGet } from './meta';
import { getMessages } from './i18n';
import { DEFAULT_LOCALE, isLocale, type Locale } from './i18n/config';
import { nextAlertState, pickAlertEmail, classifyGraphError, type AlertDecision, type AlertEvent, type AlertRow } from './connection-logic';

/**
 * The owner's Facebook connection (3.10.2026).
 *
 * When Facebook invalidates a session (password change, a security check) the
 * stored user and page tokens all stop working at once. Before this, every
 * automation then failed silently and the owner only learned about it from a
 * red line on the dashboard. Now the break is recorded per owner, the app shows
 * a reconnect banner, and the owner is told by email and WhatsApp: once when it
 * is detected and one reminder a day later. The next login clears it.
 *
 * 5.10.2026: the per-owner flag became a disconnect EVENT (see
 * connection-logic.ts). The poller also closes it when the stored tokens work
 * again, so a stale flag can no longer swallow the alert for a later, real
 * break; the email falls back to the login / partner email when no alert
 * address was saved; and /api/pages no longer alerts when only the browser's
 * own session token died while the page tokens that run the automations work.
 */

const BASE = (process.env.NEXT_PUBLIC_BASE_URL || 'https://isocialflow.com').replace(/\/$/, '');

/** Meta's answer for a token that no longer works (error 190 and its wordings). */
export function isTokenError(message: unknown): boolean {
  return classifyGraphError(message) === 'token';
}
export { isConnectionError, classifyGraphError } from './connection-logic';

/** Israeli and international numbers to the digits Green API wants (9725XXXXXXXX). Null if it cannot be a phone. */
export function normalizePhone(raw: unknown): string | null {
  let d = String(raw || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '972' + d.slice(1);
  d = d.replace(/\D/g, '');
  return d.length >= 10 && d.length <= 15 ? d : null;
}

export function isEmail(raw: unknown): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(raw || '').trim());
}

export function reconnectUrl(locale: Locale): string {
  return `${BASE}/api/auth/login?locale=${locale}&next=${encodeURIComponent(locale === DEFAULT_LOCALE ? '/dashboard' : `/${locale}/dashboard`)}`;
}

async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  const id = process.env.GREENAPI_INSTANCE_ID, token = process.env.GREENAPI_TOKEN;
  if (!id || !token) return false;
  const res = await fetch(`https://api.green-api.com/waInstance${id}/sendMessage/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: `${phone}@c.us`, message }),
  });
  if (!res.ok) throw new Error(`green-api ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return true;
}

export interface ConnectionStatus {
  broken: boolean;
  broken_at: string | null;
  notify_email: string | null;
  notify_phone: string | null;
  /** The billing email, used when no alert email was set. */
  fallback_email: string | null;
}

export async function getConnectionStatus(ownerId: string): Promise<ConnectionStatus> {
  await ensureSchema();
  const [row] = await sql!`
    SELECT c.broken_at, p.notify_email, p.notify_phone,
      (SELECT payer_email FROM subscriptions s WHERE s.owner_id = ${ownerId} AND s.payer_email IS NOT NULL ORDER BY s.created_at DESC LIMIT 1) AS fallback_email
    FROM (SELECT ${ownerId}::text AS owner_id) o
    LEFT JOIN connection_alerts c ON c.owner_id = o.owner_id
    LEFT JOIN owner_prefs p ON p.owner_id = o.owner_id`;
  return {
    broken: !!row?.broken_at,
    broken_at: row?.broken_at ? new Date(row.broken_at).toISOString() : null,
    notify_email: row?.notify_email || null,
    notify_phone: row?.notify_phone || null,
    fallback_email: row?.fallback_email || null,
  };
}

export async function saveNotifyContacts(ownerId: string, email: string | null, phone: string | null) {
  await ensureSchema();
  await sql!`
    INSERT INTO owner_prefs (owner_id, notify_email, notify_phone, updated_at) VALUES (${ownerId}, ${email}, ${phone}, now())
    ON CONFLICT (owner_id) DO UPDATE SET notify_email = EXCLUDED.notify_email, notify_phone = EXCLUDED.notify_phone, updated_at = now()`;
}

/** Run the alert state machine for one owner inside a row lock (two pollers never both send). */
async function step(ownerId: string, ev: AlertEvent, extra: { error?: string; source?: string } = {}): Promise<AlertDecision> {
  return (await sql!.begin(async (tx) => {
    // Only `tx` in here: the client holds a single connection, so a call on `sql` would wait forever.
    await tx`INSERT INTO connection_alerts (owner_id) VALUES (${ownerId}) ON CONFLICT (owner_id) DO NOTHING`;
    const [r] = await tx`SELECT broken_at, notified_at, notify_count FROM connection_alerts WHERE owner_id = ${ownerId} FOR UPDATE`;
    const prev: AlertRow = {
      broken_at: r?.broken_at ? new Date(r.broken_at).getTime() : null,
      notified_at: r?.notified_at ? new Date(r.notified_at).getTime() : null,
      notify_count: Number(r?.notify_count) || 0,
    };
    const d = nextAlertState(prev, ev, Date.now());
    const ts = (v: number | null) => (v == null ? null : new Date(v));
    if (ev.type === 'failure') {
      await tx`UPDATE connection_alerts SET broken_at = ${ts(d.row.broken_at)}, notified_at = ${ts(d.row.notified_at)},
        notify_count = ${d.row.notify_count}, last_error = ${(extra.error || '').slice(0, 500)}, source = ${extra.source || null},
        resolved_at = NULL, updated_at = now() WHERE owner_id = ${ownerId}`;
    } else if (d.closed) {
      await tx`UPDATE connection_alerts SET broken_at = NULL, notify_count = 0, resolved_at = now(),
        source = ${ev.type}, updated_at = now() WHERE owner_id = ${ownerId}`;
    }
    return d;
  })) as AlertDecision;
}

/**
 * Record that the owner's tokens stopped working, and alert once per disconnect
 * event (plus one reminder a day later). Safe to call on every poll. Never throws.
 */
export async function markBroken(ownerId: string, error: string, source: string) {
  if (!hasDb || !ownerId) return;
  try {
    await ensureSchema();
    const d = await step(ownerId, { type: 'failure' }, { error, source });
    if (d.send) await sendNotice(ownerId, d.send === 'reminder', error);
  } catch (e) {
    console.error('connection markBroken failed', ownerId, e);
  }
}

/** A successful login: the connection works again. */
export async function markResolved(ownerId: string) {
  if (!hasDb || !ownerId) return;
  try {
    await ensureSchema();
    await step(ownerId, { type: 'login' });
  } catch { /* a login must never fail over this */ }
}

/**
 * The poller read these owners' pages with the stored tokens and nothing failed:
 * close any open disconnect event, so the banner goes away and the NEXT break
 * is a new event that alerts again. One SELECT when nothing is open.
 */
export async function markHealthy(ownerIds: string[]) {
  if (!hasDb || !ownerIds.length) return;
  try {
    await ensureSchema();
    const open = await sql!`SELECT owner_id FROM connection_alerts WHERE owner_id = ANY(${ownerIds}) AND broken_at IS NOT NULL`;
    for (const r of open) await step(String(r.owner_id), { type: 'healthy' });
  } catch (e) {
    console.error('connection markHealthy failed', e);
  }
}

/**
 * Do the page tokens the automations run on still work? /api/pages sees only
 * the browser's own session token; when that one dies (an old device, a
 * logged-out session) while the stored page tokens are fine, the automations
 * keep working and an "everything stopped" alert would be false (Tolik, 3.10:
 * flagged at 23:47 while his automations kept replying until 5.10).
 * true = at least one stored page token answered; false = none did, or none stored.
 */
export async function storedTokensWork(ownerId: string): Promise<boolean> {
  if (!hasDb || !ownerId) return false;
  try {
    await ensureSchema();
    const rows = await sql!`
      SELECT DISTINCT ON (t.page_id) t.access_token FROM page_tokens t
      WHERE t.owner_id = ${ownerId} AND t.page_id IN (SELECT page_id FROM automations WHERE owner_id = ${ownerId} AND status = 'active')
      LIMIT 3`;
    for (const r of rows) {
      try { await graphGet('me', { fields: 'id', access_token: String(r.access_token) }); return true; }
      catch { /* try the next page */ }
    }
  } catch { /* fall through */ }
  return false;
}

/** Send the notice the state machine decided on: email + WhatsApp to the owner, a line to the operator. */
async function sendNotice(ownerId: string, reminder: boolean, error: string) {
  const [who] = await sql!`
    SELECT u.name, p.locale, p.notify_email, p.notify_phone,
      (SELECT payer_email FROM subscriptions s WHERE s.owner_id = ${ownerId} AND s.payer_email IS NOT NULL ORDER BY s.created_at DESC LIMIT 1) AS payer_email,
      (SELECT email FROM affiliates f WHERE f.owner_id = ${ownerId} AND f.email IS NOT NULL ORDER BY f.created_at DESC LIMIT 1) AS affiliate_email,
      u.email AS login_email,
      (SELECT count(*)::int FROM automations a WHERE a.owner_id = ${ownerId} AND a.status = 'active') AS active
    FROM (SELECT ${ownerId}::text AS owner_id) o
    LEFT JOIN app_users u ON u.owner_id = o.owner_id
    LEFT JOIN owner_prefs p ON p.owner_id = o.owner_id`;
  const locale: Locale = isLocale(who?.locale) ? who.locale : DEFAULT_LOCALE;
  const C = getMessages(locale).connection;
  const name = String(who?.name || '').split(' ')[0] || '';
  const link = reconnectUrl(locale);
  const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fill = (s: string) => s.replace('{name}', name).replace('{n}', String(who?.active ?? 0)).replace('{link}', link);
  const sent: string[] = [];

  const to = pickAlertEmail({ notify_email: who?.notify_email, payer_email: who?.payer_email, login_email: who?.login_email, affiliate_email: who?.affiliate_email });
  if (to && emailConfigured()) {
    try {
      const html = emailShell(locale, fill(C.emailTitle), `<p style="margin:0 0 14px;">${esc(fill(C.emailLine1))}</p><p style="margin:0;">${esc(fill(C.emailLine2))}</p>`, { href: link, label: C.reconnect });
      await sendEmail({ to, subject: fill(reminder ? C.emailSubjectReminder : C.emailSubject), html });
      sent.push('email');
    } catch (e) { console.error('connection email failed', ownerId, e); }
  }
  const phone = normalizePhone(who?.notify_phone);
  if (phone) {
    try { if (await sendWhatsApp(phone, fill(C.whatsapp))) sent.push('whatsapp'); }
    catch (e) { console.error('connection whatsapp failed', ownerId, e); }
  }
  // The operator hears about every break, with what reached the customer.
  const admin = normalizePhone(process.env.ALERT_ADMIN_PHONE);
  if (admin) {
    const line = `⚠️ SocialFlow: החיבור לפייסבוק נותק${reminder ? ' (תזכורת)' : ''}\n${who?.name || ownerId} (${ownerId})\nאוטומציות פעילות: ${who?.active ?? 0}\nשגיאה: ${error.slice(0, 160)}\nנשלח ללקוח: ${sent.length ? sent.join(' + ') : 'לא נשלח, אין מייל או טלפון'}`;
    try { await sendWhatsApp(admin, line); } catch { /* best effort */ }
  }
}
