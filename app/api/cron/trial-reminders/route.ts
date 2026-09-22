import { NextRequest, NextResponse } from 'next/server';
import { sql, hasDb, ensureSchema } from '@/lib/db';
import { emailConfigured, sendTrialReminder } from '@/lib/email';
import { PLAN_CATALOG, fmtIls, type PlanId } from '@/lib/plans';
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Daily: email everyone whose trial converts in three days.
 *
 * The billing screen promises this reminder, so it has to exist. The sent flag
 * lives on the subscription row, which makes a second send impossible even if
 * the cron fires twice in a day.
 */
export async function GET(req: NextRequest) {
  const bearer = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || bearer !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!hasDb) return NextResponse.json({ error: 'db_not_configured' }, { status: 503 });
  if (!emailConfigured()) return NextResponse.json({ ok: true, skipped: 'no_email_provider' });

  await ensureSchema();
  const due = await sql!`
    SELECT s.id, s.owner_id, s.plan_id, s.currency, s.trial_ends_at, s.payer_email, p.locale
    FROM subscriptions s LEFT JOIN owner_prefs p ON p.owner_id = s.owner_id
    WHERE s.status = 'trialing'
      AND s.trial_reminded_at IS NULL
      AND s.payer_email IS NOT NULL
      AND s.trial_ends_at > now()
      AND s.trial_ends_at <= now() + interval '3 days'`;

  let sent = 0;
  const failures: string[] = [];
  for (const row of due as any[]) {
    const planId = row.plan_id as PlanId;
    const plan = PLAN_CATALOG[planId] || PLAN_CATALOG.pro;
    const locale = isLocale(row.locale) ? row.locale : DEFAULT_LOCALE;
    const price = row.currency === 'ILS' ? fmtIls(plan.priceIls) : `$${plan.priceUsd}`;
    try {
      await sendTrialReminder({ to: row.payer_email, locale, planName: plan.name, endsAt: new Date(row.trial_ends_at), price });
      await sql!`UPDATE subscriptions SET trial_reminded_at = now() WHERE id = ${row.id}`;
      sent++;
    } catch (e: any) {
      failures.push(`${row.id}: ${e.message}`);
    }
  }
  return NextResponse.json({ ok: true, due: due.length, sent, ...(failures.length ? { failures } : {}) });
}
