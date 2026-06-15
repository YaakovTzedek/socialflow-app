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

  if (error) {
    return NextResponse.redirect(`${baseUrl}/?error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${baseUrl}/?error=no_code`);
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
