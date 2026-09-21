import { NextRequest, NextResponse } from 'next/server';
import { getOAuthUrl } from '@/lib/meta';
import { getRedirectUri } from '@/lib/url';

export async function GET(req: NextRequest) {
  const redirectUri = getRedirectUri();
  // Simple CSRF state token (not persisted; validated loosely on return).
  // Optional same-origin return path (used by the OAuth consent screen).
  const next = req.nextUrl.searchParams.get('next') || '';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '';
  const locale = req.nextUrl.searchParams.get('locale') || req.cookies.get('sf_locale')?.value || 'en';
  const state = Buffer.from(
    JSON.stringify({ t: Date.now(), r: Math.random().toString(36).slice(2), n: safeNext, l: locale })
  ).toString('base64url');

  const authUrl = getOAuthUrl(redirectUri, state);
  return NextResponse.redirect(authUrl);
}
