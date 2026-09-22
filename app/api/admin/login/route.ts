import { NextRequest, NextResponse } from 'next/server';
import { adminCookieName, adminCookieValue, codeMatches } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!codeMatches(String(body.code || ''))) {
    return NextResponse.json({ error: 'bad_code' }, { status: 401 });
  }
  const c = adminCookieValue();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(c.name, c.value, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: c.maxAge });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(adminCookieName(), '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}
