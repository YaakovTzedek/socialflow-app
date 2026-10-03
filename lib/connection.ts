import { sql, hasDb, ensureSchema } from './db';
import { emailConfigured, emailShell, sendEmail } from './email';
import { getMessages } from './i18n';
import { DEFAULT_LOCALE, isLocale, type Locale } from './i18n/config';

/**
 * The owner's Facebook connection (3.10.2026).
 *
 * When Facebook invalidates a session (password change, a security check) the
 * stored user and page tokens all stop working at once. Before this, every
 * automation then failed silently and the owner only learned about it from a
 * red line on the dashboard. Now the break is recorded per owner, the app shows
 * a reconnect banner, and the owner is told by email and WhatsApp: once when it
 * is detected and one reminder a day later. The next login clears it.
 */

const BASE = (process.env.NEXT_PUBLIC_BASE_URL || 'https://isocialflow.com').replace(/\/$/, '');
const REMIND_AFTER_MS = 24 * 3600_000;
const MAX_NOTICES = 2;

/** Meta's answer for a token that no longer works (error 190 and its wordings). */
export function isTokenError(message: unknown): boolean {
  const s = String(message || '');
  return /\(#190\)|code[":\s]*190|session has been invalidated|Error validating access token|access token has expired|has not authorized application|session is invalid/i.test(s);
}

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

/** Record that the owner's tokens stopped working, then alert if it is due. Never throws. */
export async function markBroken(ownerId: string, error: string, source: string) {
  if (!hasDb || !ownerId) return;
  try {
    await ensureSchema();
    // A new break (none open) restarts the notice count; an open one only refreshes the error.
    await sql!`
      INSERT INTO connection_alerts (owner_id, broken_at, last_error, source, notify_count, resolved_at, updated_at)
      VALUES (${ownerId}, now(), ${error.slice(0, 500)}, ${source}, 0, NULL, now())
      ON CONFLICT (owner_id) DO UPDATE SET
        broken_at    = COALESCE(connection_alerts.broken_at, now()),
        notify_count = CASE WHEN connection_alerts.broken_at IS NULL THEN 0 ELSE connection_alerts.notify_count END,
        notified_at  = CASE WHEN connection_alerts.broken_at IS NULL THEN NULL ELSE connection_alerts.notified_at END,
        last_error   = EXCLUDED.last_error, source = EXCLUDED.source, resolved_at = NULL, updated_at = now()`;
    await notifyIfDue(ownerId);
  } catch (e) {
    console.error('connection markBroken failed', ownerId, e);
  }
}

/** A successful login: the connection works again. */
export async function markResolved(ownerId: string) {
  if (!hasDb || !ownerId) return;
  try {
    await ensureSchema();
    await sql!`UPDATE connection_alerts SET broken_at = NULL, resolved_at = now(), updated_at = now() WHERE owner_id = ${ownerId} AND broken_at IS NOT NULL`;
  } catch { /* a login must never fail over this */ }
}

/**
 * Send the alert: on the first detection, and once more a day later if it is
 * still broken. The row is claimed (notify_count + 1) before sending, so two
 * pollers running at once never send twice.
 */
async function notifyIfDue(ownerId: string) {
  const claimed = await sql!`
    UPDATE connection_alerts SET notify_count = notify_count + 1, notified_at = now()
    WHERE owner_id = ${ownerId} AND broken_at IS NOT NULL AND notify_count < ${MAX_NOTICES}
      AND (notified_at IS NULL OR notified_at < now() - ${`${REMIND_AFTER_MS / 1000} seconds`}::interval)
    RETURNING notify_count`;
  if (!claimed.length) return;
  const reminder = Number(claimed[0].notify_count) > 1;

  const [who] = await sql!`
    SELECT u.name, p.locale, p.notify_email, p.notify_phone,
      (SELECT payer_email FROM subscriptions s WHERE s.owner_id = ${ownerId} AND s.payer_email IS NOT NULL ORDER BY s.created_at DESC LIMIT 1) AS payer_email,
      (SELECT count(*)::int FROM automations a WHERE a.owner_id = ${ownerId} AND a.status = 'active') AS active
    FROM (SELECT ${ownerId}::text AS owner_id) o
    LEFT JOIN app_users u ON u.owner_id = o.owner_id
    LEFT JOIN owner_prefs p ON p.owner_id = o.owner_id`;
  const locale: Locale = isLocale(who?.locale) ? who.locale : DEFAULT_LOCALE;
  const C = getMessages(locale).connection;
  const name = String(who?.name || '').split(' ')[0] || '';
  const link = reconnectUrl(locale);
  const fill = (s: string) => s.replace('{name}', name).replace('{n}', String(who?.active ?? 0)).replace('{link}', link);
  const sent: string[] = [];

  const to = who?.notify_email || who?.payer_email;
  if (to && emailConfigured()) {
    try {
      const html = emailShell(locale, fill(C.emailTitle), `<p style="margin:0 0 14px;">${fill(C.emailLine1)}</p><p style="margin:0;">${fill(C.emailLine2)}</p>`, { href: link, label: C.reconnect });
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
    const line = `⚠️ SocialFlow: החיבור לפייסבוק נותק${reminder ? ' (תזכורת)' : ''}\n${who?.name || ownerId} (${ownerId})\nאוטומציות פעילות: ${who?.active ?? 0}\nנשלח ללקוח: ${sent.length ? sent.join(' + ') : 'לא נשלח, אין מייל או טלפון'}`;
    try { await sendWhatsApp(admin, line); } catch { /* best effort */ }
  }
}
