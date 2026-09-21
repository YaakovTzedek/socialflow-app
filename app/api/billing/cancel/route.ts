import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { sql, hasDb, ensureSchema } from '@/lib/db';
import { cancelRecurring, billingConfigured } from '@/lib/sumit';

export const dynamic = 'force-dynamic';

// POST /api/billing/cancel → cancel the live subscription; access stays until the paid period ends.
export async function POST() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  if (!hasDb) return NextResponse.json({ error: 'db_not_configured' }, { status: 503 });
  await ensureSchema();
  const [sub] = await sql!`SELECT * FROM subscriptions WHERE owner_id = ${session.userId} AND status IN ('trialing','active') ORDER BY created_at DESC LIMIT 1`;
  if (!sub) return NextResponse.json({ error: 'no_subscription' }, { status: 404 });
  if (sub.sumit_recurring_id && billingConfigured()) {
    const r = await cancelRecurring({ recurringId: sub.sumit_recurring_id, customerId: sub.sumit_customer_id, payerEmail: sub.payer_email });
    if (!r.success) return NextResponse.json({ error: r.error }, { status: 502 });
  }
  await sql!`UPDATE subscriptions SET status = 'canceled', canceled_at = now() WHERE id = ${sub.id}`;
  return NextResponse.json({ success: true, access_until: sub.current_period_end });
}
