import { getMessages, type Locale } from './i18n';

/**
 * Transactional email through Resend.
 *
 * Plain fetch rather than the SDK: one endpoint, one shape, and nothing to keep
 * up to date. Sending is a no-op when RESEND_API_KEY is absent, so a deployment
 * without the key behaves exactly like today instead of throwing inside a cron.
 */
const API = 'https://api.resend.com/emails';

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

function fromAddress(): string {
  return process.env.RESEND_FROM || 'SocialFlow <no-reply@mail.tzedek.me>';
}

export async function sendEmail(opts: { to: string; subject: string; html: string; text?: string; replyTo?: string }): Promise<{ id: string } | null> {
  if (!emailConfigured()) return null;
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromAddress(),
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      ...(opts.text ? { text: opts.text } : {}),
      ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
    }),
  });
  const raw = await res.text();
  let data: any = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { /* keep the raw body in the error */ }
  if (!res.ok || data?.error) {
    throw new Error(`Resend ${res.status}: ${data?.error?.message || data?.message || raw.slice(0, 200)}`);
  }
  return { id: data?.id };
}

const BASE = (process.env.NEXT_PUBLIC_BASE_URL || 'https://isocialflow.com').replace(/\/$/, '');

/** Branded shell. Inline styles only, because mail clients strip a stylesheet. */
export function emailShell(locale: Locale, title: string, bodyHtml: string, cta?: { href: string; label: string }): string {
  const rtl = locale === 'he' || locale === 'ar';
  const dir = rtl ? 'rtl' : 'ltr';
  const align = rtl ? 'right' : 'left';
  return `<!doctype html><html lang="${locale}" dir="${dir}"><body style="margin:0;padding:0;background:#0f0a14;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f0a14;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#1a1024;border:1px solid rgba(255,255,255,.09);border-radius:18px;overflow:hidden;">
<tr><td style="padding:26px 28px 0;text-align:${align};">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:21px;font-weight:800;color:#ffffff;direction:ltr;text-align:${align};">Social<span style="color:#F77737;">Flow</span></div>
</td></tr>
<tr><td style="padding:18px 28px 0;text-align:${align};">
<h1 style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:1.3;color:#ffffff;">${title}</h1>
<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.7;color:#C9BBD3;">${bodyHtml}</div>
</td></tr>
${cta ? `<tr><td style="padding:24px 28px 0;text-align:${align};">
<a href="${cta.href}" style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;background:#E1306C;border-radius:999px;padding:13px 26px;">${cta.label}</a>
</td></tr>` : ''}
<tr><td style="padding:26px 28px 24px;text-align:${align};">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#8B7B99;"><a href="${BASE}" style="color:#8B7B99;">isocialflow.com</a></div>
</td></tr>
</table>
</td></tr></table></body></html>`;
}

/** The reminder the billing screen promises, three days before a trial converts. */
export async function sendTrialReminder(opts: { to: string; locale: Locale; planName: string; endsAt: Date; price: string }) {
  const m = getMessages(opts.locale);
  const E = m.email.trialReminder;
  const date = opts.endsAt.toLocaleDateString(opts.locale === 'he' ? 'he-IL' : opts.locale, { day: 'numeric', month: 'long' });
  const fill = (s: string) => s.replace('{plan}', opts.planName).replace('{date}', date).replace('{price}', opts.price);
  const html = emailShell(
    opts.locale,
    fill(E.title),
    `<p style="margin:0 0 14px;">${fill(E.line1)}</p><p style="margin:0;">${fill(E.line2)}</p>`,
    { href: `${BASE}/billing`, label: E.cta },
  );
  return sendEmail({ to: opts.to, subject: fill(E.subject), html });
}

/**
 * Tell the owner a beta signup landed. Deliberately plain: the point is the
 * phone number, so it should be readable from a phone notification without
 * opening anything. Silent when BETA_NOTIFY_TO is unset.
 */
export async function sendBetaSignupNotice(row: { phone: string; role: string; tool: string; locale: string }) {
  const to = process.env.BETA_NOTIFY_TO;
  if (!to || !emailConfigured()) return null;
  const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = emailShell(
    'he',
    'נרשם חדש לבטא',
    `<p style="margin:0 0 10px;"><strong style="color:#fff;">טלפון:</strong> <a href="tel:${esc(row.phone)}" style="color:#FF8FB0;">${esc(row.phone)}</a></p>
     <p style="margin:0 0 10px;"><strong style="color:#fff;">מה הוא עושה:</strong> ${esc(row.role)}</p>
     <p style="margin:0 0 10px;"><strong style="color:#fff;">באיזה כלי משתמש היום:</strong> ${esc(row.tool)}</p>
     <p style="margin:0;"><strong style="color:#fff;">שפת הדף:</strong> ${esc(row.locale)}</p>`,
  );
  return sendEmail({
    to,
    subject: `נרשם חדש לבטא: ${row.phone}`,
    html,
    text: `טלפון: ${row.phone}\nמה הוא עושה: ${row.role}\nבאיזה כלי משתמש היום: ${row.tool}\nשפת הדף: ${row.locale}`,
  });
}
