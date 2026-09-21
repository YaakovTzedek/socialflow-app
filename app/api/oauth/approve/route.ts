import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getClient, issueCode, base } from '@/lib/oauth';

export const dynamic = 'force-dynamic';

// The consent form on /oauth/authorize posts here; we mint the code and bounce back to the client.
export async function POST(req: NextRequest) {
  const session = await getSession();
  const form = await req.formData();
  const clientId = String(form.get('client_id') || '');
  const redirectUri = String(form.get('redirect_uri') || '');
  const state = String(form.get('state') || '');
  const codeChallenge = String(form.get('code_challenge') || '') || null;
  const scope = String(form.get('scope') || '') || null;
  const decision = String(form.get('decision') || '');
  const locale = String(form.get('locale') || req.cookies.get('sf_locale')?.value || 'en');
  const client = await getClient(clientId);
  if (!client || !client.redirect_uris.includes(redirectUri)) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const back = new URL(redirectUri);
  if (state) back.searchParams.set('state', state);
  if (!session.userId) return NextResponse.redirect(`${base()}/api/auth/login?next=${encodeURIComponent(req.headers.get('referer') || '/oauth/authorize')}`);
  if (decision !== 'allow') { back.searchParams.set('error', 'access_denied'); return NextResponse.redirect(back.toString()); }
  const code = await issueCode({ clientId, ownerId: session.userId, redirectUri, codeChallenge, scope, locale });
  back.searchParams.set('code', code);
  return NextResponse.redirect(back.toString(), { status: 303 });
}
