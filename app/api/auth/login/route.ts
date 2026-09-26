import { NextRequest, NextResponse } from 'next/server';
import { getOAuthUrl } from '@/lib/meta';
import { getRedirectUri } from '@/lib/url';
import { DEFAULT_LOCALE, PICK_COOKIE, isAppPath, isLocale, localePath, preferredLocale, splitPath } from '@/lib/i18n/config';

export async function GET(req: NextRequest) {
  const redirectUri = getRedirectUri();
  // Simple CSRF state token (not persisted; validated loosely on return).
  // Optional same-origin return path (used by the OAuth consent screen).
  const next = req.nextUrl.searchParams.get('next') || '';
  let safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '';
  // A page in a non-default language keeps it. English is only a default at
  // the bare path, so there the explicit pick or the browser language decides
  // (a Hebrew browser that logs in from the English homepage lands in Hebrew).
  const asked = req.nextUrl.searchParams.get('locale') || req.cookies.get('sf_locale')?.value;
  const locale = isLocale(asked) && asked !== DEFAULT_LOCALE
    ? asked
    : preferredLocale(req.cookies.get(PICK_COOKIE)?.value, req.headers.get('accept-language'));
  if (safeNext) {
    const { locale: nextLocale, rest } = splitPath(safeNext);
    if (nextLocale !== locale && isAppPath(rest)) safeNext = localePath(locale, rest);
  }
  const state = Buffer.from(
    JSON.stringify({ t: Date.now(), r: Math.random().toString(36).slice(2), n: safeNext, l: locale })
  ).toString('base64url');

  const authUrl = getOAuthUrl(redirectUri, state);
  return NextResponse.redirect(authUrl);
}
