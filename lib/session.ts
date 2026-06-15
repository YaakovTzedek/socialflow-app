import { getIronSession, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  // Long-lived Facebook user access token
  userAccessToken?: string;
  // Basic profile info for display
  userId?: string;
  userName?: string;
  // When the user token expires (epoch ms)
  tokenExpiresAt?: number;
}

export const sessionOptions: SessionOptions = {
  password:
    process.env.SESSION_SECRET ||
    'insecure_dev_secret_please_change_me_to_32+_chars',
  cookieName: 'socialflow_session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 55, // 55 days (slightly under the 60-day Meta token life)
    path: '/',
  },
};

export async function getSession() {
  return getIronSession<SessionData>(cookies(), sessionOptions);
}
