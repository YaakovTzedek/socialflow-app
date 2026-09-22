import { NextRequest, NextResponse } from 'next/server';
import { sql, hasDb, ensureSchema } from '@/lib/db';
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n';
import { sendBetaSignupNotice } from '@/lib/email';

export const dynamic = 'force-dynamic';

/** Digits only, ignoring the usual separators, so +972 50-123-4567 counts as 12. */
function digitsOf(v: string) {
  return v.replace(/[^\d]/g, '');
}

/**
 * Beta waiting list. Three fields, no account: a phone we can call, what the
 * person does, and the tool they use today. The honeypot and the digit check
 * keep out the form bots that hit the tzedek.me contact form in September.
 */
export async function POST(req: NextRequest) {
  if (!hasDb) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  const body = await req.json().catch(() => ({}));

  if (typeof body.website === 'string' && body.website.trim()) {
    return NextResponse.json({ ok: true }); // honeypot: answer normally, store nothing
  }

  const phoneRaw = String(body.phone || '').trim();
  const role = String(body.role || '').trim().slice(0, 300);
  const tool = String(body.tool || '').trim().slice(0, 300);
  const digits = digitsOf(phoneRaw);

  if (digits.length < 8 || digits.length > 15 || /^(\d)\1+$/.test(digits)) {
    return NextResponse.json({ error: 'bad_phone' }, { status: 400 });
  }
  if (!role || !tool) return NextResponse.json({ error: 'missing' }, { status: 400 });

  const locale = isLocale(body.locale) ? body.locale : DEFAULT_LOCALE;
  await ensureSchema();
  const [row] = await sql!`
    INSERT INTO beta_signups (phone, role, tool, locale, source)
    VALUES (${phoneRaw.slice(0, 40)}, ${role}, ${tool}, ${locale}, ${'landing'})
    ON CONFLICT (phone) DO NOTHING
    RETURNING id`;

  // The signup is already saved; a mail provider hiccup must not fail the form.
  if (row) {
    try { await sendBetaSignupNotice({ phone: phoneRaw, role, tool, locale }); } catch { /* the row is what matters */ }
  }

  return NextResponse.json({ ok: true, duplicate: !row });
}
