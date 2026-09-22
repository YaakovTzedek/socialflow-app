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

/** Remove one signup (a test row, or someone who asks to be taken off). */
export async function DELETE(req: NextRequest) {
  const expected = process.env.ADMIN_CLAIM_CODE;
  const code = req.nextUrl.searchParams.get('code') || '';
  if (!expected || code.length !== expected.length || code !== expected) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (!hasDb) return NextResponse.json({ error: 'db_not_configured' }, { status: 503 });
  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'bad_id' }, { status: 400 });
  await ensureSchema();
  const rows = await sql!`DELETE FROM beta_signups WHERE id = ${id} RETURNING id`;
  return NextResponse.json({ ok: true, deleted: rows.length });
}
