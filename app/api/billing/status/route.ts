import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { hasDb } from '@/lib/db';
import { getEntitlement, getUsage } from '@/lib/entitlements';
import { PLAN_CATALOG, TRIAL } from '@/lib/plans';
import { billingConfigured, billingTestMode } from '@/lib/sumit';

export const dynamic = 'force-dynamic';

// GET /api/billing/status → plan, limits, usage, subscription, catalog.
export async function GET() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  if (!hasDb) return NextResponse.json({ error: 'db_not_configured' }, { status: 503 });
  const ent = await getEntitlement(session.userId);
  const usage = await getUsage(session.userId, ent.plan);
  const sub = ent.subscription;
  return NextResponse.json({
    plan_id: ent.planId, plan: ent.plan, source: ent.source, usage,
    subscription: sub ? {
      id: sub.id, plan_id: sub.plan_id, interval: sub.interval, status: sub.status, trial_ends_at: sub.trial_ends_at,
      current_period_end: sub.current_period_end, payer_email: sub.payer_email, amount_agorot: sub.amount_agorot, currency: sub.currency,
      created_at: sub.created_at, canceled_at: sub.canceled_at,
    } : null,
    catalog: PLAN_CATALOG, trial: TRIAL,
    billing: {
      configured: billingConfigured(), test_mode: billingTestMode(),
      company_id: process.env.NEXT_PUBLIC_SUMIT_COMPANY_ID || process.env.SUMIT_COMPANY_ID || null,
      public_key: process.env.NEXT_PUBLIC_SUMIT_PUBLIC_KEY || null,
    },
  });
}
