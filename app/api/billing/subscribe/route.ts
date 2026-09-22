import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { sql, hasDb, ensureSchema } from '@/lib/db';
import { PLAN_CATALOG, TRIAL, priceFor, type Interval, type PlanId } from '@/lib/plans';
import { createSubscription, billingConfigured, cancelRecurring } from '@/lib/sumit';
import { recordCommission } from '@/lib/affiliates';

export const dynamic = 'force-dynamic';

// POST /api/billing/subscribe { plan_id, interval, currency, trial, singleUseToken, payerName, payerEmail, payerPhone }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  if (!hasDb) return NextResponse.json({ error: 'db_not_configured' }, { status: 503 });
  if (!billingConfigured()) return NextResponse.json({ error: 'billing_not_configured' }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const planId = String(body.plan_id || '') as PlanId;
  const interval: Interval = body.interval === 'year' ? 'year' : 'month';
  const currency: 'ILS' | 'USD' = body.currency === 'USD' ? 'USD' : 'ILS';
  const trial = body.trial === true;
  const { singleUseToken, payerName, payerEmail, payerPhone } = body;
  if (!(planId in PLAN_CATALOG) || planId === 'free') return NextResponse.json({ error: 'bad_plan' }, { status: 400 });
  if (!singleUseToken || !payerName || !payerEmail) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  if (trial && (planId !== TRIAL.plan || interval !== 'month')) return NextResponse.json({ error: 'trial_only_pro_monthly' }, { status: 400 });

  await ensureSchema();
  // One trial per account, ever.
  if (trial) {
    const [used] = await sql!`SELECT 1 FROM subscriptions WHERE owner_id = ${session.userId} AND trial_ends_at IS NOT NULL LIMIT 1`;
    if (used) return NextResponse.json({ error: 'trial_used' }, { status: 400 });
  }

  const result = await createSubscription({ planId, interval, currency, trial, locale: typeof body.locale === 'string' ? body.locale : req.cookies.get('sf_locale')?.value, singleUseToken, payerName: String(payerName), payerEmail: String(payerEmail), payerPhone: payerPhone ? String(payerPhone) : undefined });
  if (!result.success) return NextResponse.json({ error: result.error, declined: !!result.declined }, { status: 402 });

  // Replace any previous live subscription (upgrade/downgrade): cancel the old standing order best effort.
  const old = await sql!`SELECT id, sumit_recurring_id, sumit_customer_id, payer_email FROM subscriptions WHERE owner_id = ${session.userId} AND status IN ('trialing','active')`;
  for (const o of old as any[]) {
    if (o.sumit_recurring_id) await cancelRecurring({ recurringId: o.sumit_recurring_id, customerId: o.sumit_customer_id, payerEmail: o.payer_email }).catch(() => {});
    await sql!`UPDATE subscriptions SET status = 'canceled', canceled_at = now() WHERE id = ${o.id}`;
  }

  const periodEnd = new Date();
  if (trial) periodEnd.setUTCDate(periodEnd.getUTCDate() + TRIAL.days);
  else if (interval === 'year') periodEnd.setUTCFullYear(periodEnd.getUTCFullYear() + 1);
  else periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
  const amountAgorot = Math.round(priceFor(planId, interval, currency) * 100);

  const [sub] = await sql!`
    INSERT INTO subscriptions (owner_id, plan_id, interval, status, trial_ends_at, current_period_end,
      sumit_customer_id, sumit_recurring_id, payer_name, payer_email, amount_agorot, currency)
    VALUES (${session.userId}, ${planId}, ${interval}, ${trial ? 'trialing' : 'active'}, ${trial ? periodEnd : null}, ${periodEnd},
      ${result.customerId}, ${result.recurringId}, ${String(payerName)}, ${String(payerEmail)}, ${amountAgorot}, ${currency})
    RETURNING id`;
  await sql!`
    INSERT INTO invoices (owner_id, subscription_id, sumit_document_id, sumit_payment_id, amount_agorot, currency, pdf_url, status, raw)
    VALUES (${session.userId}, ${sub.id}, ${result.documentId}, ${result.paymentId}, ${Math.round(result.amount * 100)}, ${result.currency}, ${result.pdfUrl}, ${'paid'}, ${sql!.json(result.raw as any)})`;

  // Partner commission on what was actually charged, never on the list price.
  try {
    await recordCommission({
      ownerId: session.userId,
      invoiceId: null,
      amountAgorot: Math.round(result.amount * 100),
      currency: result.currency,
    });
  } catch { /* the subscription is live either way */ }

  return NextResponse.json({ success: true, subscription_id: sub.id, plan_id: planId, trial, period_end: periodEnd.toISOString(), pdf_url: result.pdfUrl });
}
