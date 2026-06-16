import { NextRequest, NextResponse } from 'next/server';
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getMe,
} from '@/lib/meta';
import { getSession } from '@/lib/session';
import { getBaseUrl, getRedirectUri } from '@/lib/url';

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

    return NextResponse.redirect(`${baseUrl}/dashboard`);
  } catch (e: any) {
    return NextResponse.redirect(
      `${baseUrl}/?error=${encodeURIComponent(e.message || 'auth_failed')}`
    );
  }
}
