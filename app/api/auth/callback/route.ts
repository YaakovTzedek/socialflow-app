import { NextRequest, NextResponse } from 'next/server';
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getMe,
  listPages,
} from '@/lib/meta';
import { getSession } from '@/lib/session';
import { getBaseUrl, getRedirectUri } from '@/lib/url';
import { sql, hasDb, ensureSchema } from '@/lib/db';
import { isLocale, localePath, type Locale } from '@/lib/i18n/config';
import { AFF_COOKIE, bindReferral } from '@/lib/affiliates';
import { storePageTokens } from '@/lib/auth-helpers';

export async function GET(req: NextRequest) {
  const baseUrl = getBaseUrl();
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  // Facebook can report failures across several params — capture them all.
  const errorDetail =
    searchParams.get('error_description') ||
    searchParams.get('error_message') ||
    searchParams.get('error_reason') ||
    error;

  if (error || errorDetail) {
    return NextResponse.redirect(
      `${baseUrl}/?error=${encodeURIComponent(errorDetail || error || 'oauth_error')}`
    );
  }
  if (!code) {
    // Surface which params DID arrive so we can diagnose.
    const keys = Array.from(searchParams.keys()).join(',') || 'none';
    return NextResponse.redirect(
      `${baseUrl}/?error=${encodeURIComponent('no_code (params: ' + keys + ')')}`
    );
  }

  try {
    const redirectUri = getRedirectUri();

    // 1. Exchange code → short-lived token
    const short = await exchangeCodeForToken(code, redirectUri);

    // 2. Upgrade → long-lived token (~60 days)
    const long = await getLongLivedToken(short.access_token);

    // 3. Fetch basic profile for display
    const me = await getMe(long.access_token);

    // 4. Persist in the encrypted session cookie
    const session = await getSession();
    session.userAccessToken = long.access_token;
    session.userId = me.id;
    session.userName = me.name;
    session.tokenExpiresAt = Date.now() + (long.expires_in ?? 5184000) * 1000;
    await session.save();

    // Store a page token for every page the user just approved.
    //
    // These used to be written only when the first automation was created,
    // which meant the MCP server could list a page and then refuse to read its
    // posts: "page_not_ready". Someone connecting through Claude or ChatGPT had
    // to come back to the web app, build one automation by hand, and only then
    // could the chat do anything. The permission belongs to the connection, not
    // to the first automation, so it is stored here.
    if (hasDb) {
      try {
        await storePageTokens(me.id, await listPages(long.access_token));
      } catch { /* a login must never fail because Meta was slow to list pages */ }
    }

    // Credit the partner whose link brought this account, first touch only.
    const affCode = req.cookies.get(AFF_COOKIE)?.value;
    if (affCode && hasDb) {
      try { await bindReferral(me.id, affCode); } catch { /* never block a login over attribution */ }
    }

    // Back to where the login started (e.g. the OAuth consent screen), same-origin paths only.
    let next = '';
    let locale = 'en';
    try {
      const st = JSON.parse(Buffer.from(searchParams.get('state') || '', 'base64url').toString('utf8'));
      if (typeof st?.n === 'string' && st.n.startsWith('/') && !st.n.startsWith('//')) next = st.n;
      if (isLocale(st?.l)) locale = st.l;
    } catch { /* ignore */ }
    // Remember the user's language server-side (DM branding, MCP defaults).
    if (hasDb) { try { await ensureSchema(); await sql!`INSERT INTO owner_prefs (owner_id, locale) VALUES (${me.id}, ${locale}) ON CONFLICT (owner_id) DO UPDATE SET locale = EXCLUDED.locale, updated_at = now()`; } catch { /* best effort */ } }
    const res = NextResponse.redirect(`${baseUrl}${next || localePath(locale as Locale, '/dashboard')}`);
    res.cookies.set('sf_locale', locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
    return res;
  } catch (e: any) {
    return NextResponse.redirect(
      `${baseUrl}/?error=${encodeURIComponent(e.message || 'auth_failed')}`
    );
  }
}
