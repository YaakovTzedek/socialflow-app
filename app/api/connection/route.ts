import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { hasDb } from '@/lib/db';
import { getConnectionStatus, saveNotifyContacts, isEmail, normalizePhone } from '@/lib/connection';

export const dynamic = 'force-dynamic';

// GET /api/connection → is the Facebook connection broken, and where alerts go.
export async function GET() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  if (!hasDb) return NextResponse.json({ broken: false });
  try {
    return NextResponse.json(await getConnectionStatus(session.userId));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/connection { email, phone } → save where to alert. Empty clears a field.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  if (session.impersonating) return NextResponse.json({ error: 'read_only' }, { status: 403 });
  if (!hasDb) return NextResponse.json({ error: 'db_not_configured' }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || '').trim() || null;
  const rawPhone = String(body.phone || '').trim();
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if ((email && !isEmail(email)) || (rawPhone && !phone)) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  await saveNotifyContacts(session.userId, email, phone);
  return NextResponse.json({ ok: true, email, phone });
}
