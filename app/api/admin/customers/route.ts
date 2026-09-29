import { NextResponse } from 'next/server';
import { hasDb } from '@/lib/db';
import { isAdminRequest, isOwnerRequest } from '@/lib/admin';
import { listCustomers, impersonationLog } from '@/lib/admin-customers';
import { getRawSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Every account in SocialFlow, with plan, pages, automations and activity, plus the impersonation log. */
export async function GET() {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!hasDb) return NextResponse.json({ error: 'db_not_configured' }, { status: 503 });
  try {
    const [customers, log, owner, raw] = await Promise.all([listCustomers(), impersonationLog(100), isOwnerRequest(), getRawSession()]);
    return NextResponse.json({
      customers,
      impersonationLog: log,
      // Only the owner's own Facebook session can impersonate; the code cookie alone cannot.
      canImpersonate: owner,
      impersonating: owner ? raw.impersonate?.id || null : null,
      now: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
