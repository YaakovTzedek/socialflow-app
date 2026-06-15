import { NextResponse } from 'next/server';
import { getOAuthUrl } from '@/lib/meta';
import { getRedirectUri } from '@/lib/url';

export async function GET() {
  const redirectUri = getRedirectUri();
  // Simple CSRF state token (not persisted; validated loosely on return).
  const state = Buffer.from(
    JSON.stringify({ t: Date.now(), r: Math.random().toString(36).slice(2) })
  ).toString('base64url');

  const authUrl = getOAuthUrl(redirectUri, state);
  return NextResponse.redirect(authUrl);
}
