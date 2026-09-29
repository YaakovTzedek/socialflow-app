import { NextRequest, NextResponse } from 'next/server';
import { getRawSession } from '@/lib/session';
import { isOwnerId } from '@/lib/owner';
import { sql, hasDb, ensureSchema } from '@/lib/db';
import { recordEvent } from '@/lib/audit';
import { isLocale, localePath } from '@/lib/i18n/config';

export const dynamic = 'force-dynamic';

/**
 * "Enter as this customer". Owner only, decided from the real Facebook
 * session (the admin code cookie is not enough: the impersonation state lives
 * inside the owner's own encrypted session). The session keeps the owner's
 * identity and gains `impersonate`; lib/session.ts then resolves the current
 * user to the customer everywhere, read only (lib/impersonation.ts).
 */
export async function POST(req: NextRequest) {
  const session = await getRawSession();
  if (!session.userAccessToken || !isOwnerId(session.userId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!hasDb) return NextResponse.json({ error: 'db_not_configured' }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const target = String(body.owner_id || '').trim();
  if (!/^[0-9]{3,40}$/.test(target)) return NextResponse.json({ error: 'bad_owner_id' }, { status: 400 });
  if (target === session.userId) return NextResponse.json({ error: 'זה החשבון שלך' }, { status: 400 });

  await ensureSchema();
  // The account has to exist somewhere in SocialFlow; its name comes from the
  // login record, then a payer name, then its first page.
  const [row] = await sql!`
    SELECT
      (SELECT name FROM app_users WHERE owner_id = ${target}) AS user_name,
      (SELECT payer_name FROM subscriptions WHERE owner_id = ${target} AND payer_name IS NOT NULL ORDER BY created_at DESC LIMIT 1) AS payer_name,
      (SELECT page_name FROM page_tokens WHERE owner_id = ${target} AND page_name IS NOT NULL ORDER BY page_name LIMIT 1) AS page_name,
      EXISTS (SELECT 1 FROM app_users WHERE owner_id = ${target})
        OR EXISTS (SELECT 1 FROM page_tokens WHERE owner_id = ${target})
        OR EXISTS (SELECT 1 FROM automations WHERE owner_id = ${target})
        OR EXISTS (SELECT 1 FROM api_keys WHERE owner_id = ${target})
        OR EXISTS (SELECT 1 FROM subscriptions WHERE owner_id = ${target})
        OR EXISTS (SELECT 1 FROM owner_prefs WHERE owner_id = ${target})
        OR EXISTS (SELECT 1 FROM plan_overrides WHERE owner_id = ${target}) AS known`;
  if (!row?.known) return NextResponse.json({ error: 'customer_not_found' }, { status: 404 });
  const name = String(row.user_name || row.payer_name || row.page_name || target).slice(0, 120);

  const previous = session.impersonate;
  if (previous?.id && previous.id !== target) {
    await recordEvent(previous.id, 'impersonation_stop', { reason: 'switched', seconds: Math.round((Date.now() - previous.startedAt) / 1000) }, session.userId);
  }
  session.impersonate = { id: target, name, startedAt: Date.now() };
  await session.save();
  await recordEvent(target, 'impersonation_start', { name }, session.userId);

  const loc = req.cookies.get('sf_locale')?.value;
  return NextResponse.json({ ok: true, name, redirect: localePath(isLocale(loc) ? loc : 'he', '/dashboard') });
}

/** Leave the customer's account and return to the owner's own view. */
export async function DELETE() {
  const session = await getRawSession();
  const imp = session.impersonate;
  if (!imp) return NextResponse.json({ ok: true, was: null });
  delete session.impersonate;
  await session.save();
  if (isOwnerId(session.userId)) {
    await recordEvent(imp.id, 'impersonation_stop', { reason: 'exit', seconds: Math.round((Date.now() - imp.startedAt) / 1000) }, session.userId);
  }
  // The admin area is Hebrew only, so it lives under /he whatever the app language.
  return NextResponse.json({ ok: true, was: imp.id, redirect: `/he/admin/customers/${encodeURIComponent(imp.id)}` });
}
