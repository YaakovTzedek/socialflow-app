import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { sql, hasDb, ensureSchema } from '@/lib/db';
import { PLAN_CATALOG, type PlanId } from '@/lib/plans';

export const dynamic = 'force-dynamic';

/**
 * One-click owner claim. Visiting this while signed in, with the code held in
 * ADMIN_CLAIM_CODE, writes a plan_overrides row for the current account. It
 * exists because Vercel never hands back the value of a sensitive env var, so
 * the database cannot be reached from outside the deployment to seed an
 * override by hand. Unset ADMIN_CLAIM_CODE to close the door.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.ADMIN_CLAIM_CODE;
  const code = req.nextUrl.searchParams.get('code') || '';
  if (!expected || code.length !== expected.length || code !== expected) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'sign_in_first' }, { status: 401 });
  if (!hasDb) return NextResponse.json({ error: 'db_not_configured' }, { status: 503 });

  const planParam = req.nextUrl.searchParams.get('plan') || 'agency';
  const plan: PlanId = (planParam in PLAN_CATALOG ? planParam : 'agency') as PlanId;

  await ensureSchema();
  await sql!`
    INSERT INTO plan_overrides (owner_id, plan_id, note)
    VALUES (${session.userId}, ${plan}, ${'owner claim'})
    ON CONFLICT (owner_id) DO UPDATE SET plan_id = EXCLUDED.plan_id, note = EXCLUDED.note`;

  return NextResponse.json({
    ok: true,
    owner_id: session.userId,
    name: session.userName || null,
    plan_id: plan,
    plan: PLAN_CATALOG[plan].name,
    publishing: PLAN_CATALOG[plan].limits.publishing,
    mcp: PLAN_CATALOG[plan].limits.mcp,
  });
}
