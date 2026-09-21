import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_LOCALE, isLocale, negotiate } from '@/lib/i18n/config';

/**
 * Locale routing. English is served at the bare path and internally rewritten
 * to /en/...; every other locale keeps its prefix (/he/...). /en/... redirects
 * to the bare path so there is exactly one canonical URL per page. The chosen
 * locale is remembered in the sf_locale cookie (used by the auth callback and
 * by server-side messages such as DM branding).
 */
export const config = {
  matcher: ['/((?!api|_next|\\.well-known|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\..*).*)'],
};

const COOKIE = 'sf_locale';

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const seg = pathname.split('/')[1];

  if (isLocale(seg)) {
    if (seg === DEFAULT_LOCALE) {
      const url = req.nextUrl.clone();
      url.pathname = pathname.slice(seg.length + 1) || '/';
      return NextResponse.redirect(url, 308);
    }
    const res = NextResponse.next();
    res.cookies.set(COOKIE, seg, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
    return res;
  }

  // Bare path: first visit to the landing page follows the browser language
  // (only when no explicit choice was made before), otherwise English.
  if (pathname === '/' && !req.cookies.get(COOKIE)) {
    const guess = negotiate(req.headers.get('accept-language'));
    if (guess !== DEFAULT_LOCALE) {
      const url = req.nextUrl.clone();
      url.pathname = `/${guess}`;
      const res = NextResponse.redirect(url, 307);
      res.cookies.set(COOKIE, guess, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
      return res;
    }
  }

  const url = req.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}${pathname}`;
  url.search = search;
  const res = NextResponse.rewrite(url);
  res.cookies.set(COOKIE, DEFAULT_LOCALE, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  return res;
}
