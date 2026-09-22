import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n/config';

/**
 * Locale routing. English is served at the bare path and internally rewritten
 * to /en/...; every other locale keeps its prefix (/he/...). /en/... redirects
 * to the bare path so there is exactly one canonical URL per page. The chosen
 * locale is remembered in the sf_locale cookie (used by the auth callback and
 * by server-side messages such as DM branding). The bare path always serves
 * English: the browser language never redirects a visitor away from it.
 */
export const config = {
  matcher: ['/((?!api|_next|\\.well-known|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\..*).*)'],
};

const COOKIE = 'sf_locale';
const AFF_COOKIE = 'sf_aff';
const AFF_DAYS = 90;

/**
 * A partner link (?aff=code) is remembered for ninety days. Set on whatever
 * response the locale routing already produced, so the visitor is never sent
 * through an extra redirect just to record where they came from.
 */
function rememberAffiliate(req: NextRequest, res: NextResponse): NextResponse {
  const code = req.nextUrl.searchParams.get('aff');
  if (code && /^[a-z0-9]{3,24}$/.test(code) && req.cookies.get(AFF_COOKIE)?.value !== code) {
    res.cookies.set(AFF_COOKIE, code, { path: '/', maxAge: AFF_DAYS * 86400, sameSite: 'lax' });
  }
  return res;
}

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
    return rememberAffiliate(req, res);
  }

  const url = req.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}${pathname}`;
  url.search = search;
  const res = NextResponse.rewrite(url);
  res.cookies.set(COOKIE, DEFAULT_LOCALE, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  return rememberAffiliate(req, res);
}
