import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getSession } from '@/lib/session';
import { sql, hasDb, ensureSchema } from '@/lib/db';
import { isLocale } from '@/lib/i18n/config';

export const dynamic = 'force-dynamic';

// GET /api/mcp-keys → the user's keys (masked). POST → mint one. DELETE ?key= → revoke.
export async function GET() {
  if (!hasDb) return NextResponse.json({ error: 'db_not_configured', keys: [] });
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  await ensureSchema();
  const rows = await sql!`SELECT key, label, created_at, last_used_at FROM api_keys WHERE owner_id = ${session.userId} AND revoked_at IS NULL ORDER BY created_at DESC`;
  return NextResponse.json({ keys: rows.map((r: any) => ({ key: r.key, masked: `${r.key.slice(0, 6)}…${r.key.slice(-4)}`, label: r.label, created_at: r.created_at, last_used_at: r.last_used_at })) });
}

export async function POST(req: NextRequest) {
  if (!hasDb) return NextResponse.json({ error: 'db_not_configured' }, { status: 503 });
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const label = String(body.label || 'MCP').slice(0, 60);
  const locale = isLocale(body.locale) ? body.locale : (req.cookies.get('sf_locale')?.value || 'en');
  const key = 'sf_' + randomBytes(24).toString('base64url');
  await ensureSchema();
  await sql!`INSERT INTO api_keys (key, owner_id, label, locale) VALUES (${key}, ${session.userId}, ${label}, ${locale})`;
  return NextResponse.json({ key, label });
}

export async function DELETE(req: NextRequest) {
  if (!hasDb) return NextResponse.json({ error: 'db_not_configured' }, { status: 503 });
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  const key = req.nextUrl.searchParams.get('key') || '';
  await ensureSchema();
  await sql!`UPDATE api_keys SET revoked_at = now() WHERE key = ${key} AND owner_id = ${session.userId}`;
  return NextResponse.json({ success: true });
}
