import { NextRequest, NextResponse } from 'next/server';
import { sql, hasDb, ensureSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * The beta waiting list, newest first. Guarded by the same ADMIN_CLAIM_CODE as
 * the owner claim, because the signups land in a table that is otherwise
 * unreachable from outside the deployment.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.ADMIN_CLAIM_CODE;
  const code = req.nextUrl.searchParams.get('code') || '';
  if (!expected || code.length !== expected.length || code !== expected) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (!hasDb) return NextResponse.json({ error: 'db_not_configured' }, { status: 503 });
  await ensureSchema();
  const rows = await sql!`SELECT id, phone, role, tool, locale, created_at FROM beta_signups ORDER BY created_at DESC LIMIT 500`;
  return NextResponse.json({ count: rows.length, signups: rows });
}
