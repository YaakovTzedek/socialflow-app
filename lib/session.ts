import { getIronSession, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import { isOwnerId } from './owner';

export interface ImpersonationState {
  /** The customer's owner_id (their Facebook user id). */
  id: string;
  /** Display name at the moment the owner entered. */
  name: string;
  /** epoch ms */
  startedAt: number;
}

export interface SessionData {
  // Long-lived Facebook user access token
  userAccessToken?: string;
  // Basic profile info for display
  userId?: string;
  userName?: string;
  // When the user token expires (epoch ms)
  tokenExpiresAt?: number;
  // Set only by /api/admin/impersonate, and only honoured while the session
  // itself belongs to the SaaS owner (see getSession below).
  impersonate?: ImpersonationState;
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

/**
 * Stand-in for the user token while the owner views a customer's account.
 * We never hold the customer's own Facebook user token, and the owner's token
 * must never be used on the customer's behalf (a page listing made with it
 * would be stored under the customer's owner_id). Any Graph call made with
 * this value fails as an invalid token, so a forgotten code path breaks loudly
 * instead of acting as the wrong person. Page tokens stored in page_tokens for
 * the customer still work for reading.
 */
export const IMPERSONATION_TOKEN = 'sf-impersonation-read-only';

/** Impersonation lapses on its own after this long, so it is never left on by accident. */
export const IMPERSONATION_TTL_MS = 12 * 60 * 60 * 1000;

export function isImpersonationToken(token: string | null | undefined): boolean {
  return token === IMPERSONATION_TOKEN;
}

/** The encrypted cookie itself. Only for code that writes it (login, logout, impersonation). */
export async function getRawSession() {
  return getIronSession<SessionData>(cookies(), sessionOptions);
}

export interface AppSession {
  userAccessToken?: string;
  userId?: string;
  userName?: string;
  tokenExpiresAt?: number;
  /** Set while the owner is viewing a customer's account. */
  impersonating: ImpersonationState | null;
  /** The person actually signed in (the owner while impersonating). */
  realUserId?: string;
  realUserName?: string;
  /** The signed-in person is the SaaS owner (server decided, env driven). */
  isOwner: boolean;
}

/**
 * "The current user" for every page and API route.
 *
 * While the SaaS owner impersonates a customer, userId and userName are the
 * customer's, so every query scoped by owner_id shows the customer's data.
 * The impersonation field is ignored unless the session's own user is the
 * owner, so a cookie that somehow carries it for anyone else changes nothing.
 */
export async function getSession(): Promise<AppSession> {
  const raw = await getRawSession();
  const isOwner = isOwnerId(raw.userId) && !!raw.userAccessToken;
  const imp = raw.impersonate;
  // A forgotten "view as" ends by itself after IMPERSONATION_TTL_MS.
  const fresh = !!imp?.startedAt && Date.now() - imp.startedAt < IMPERSONATION_TTL_MS;
  if (isOwner && imp?.id && fresh && imp.id !== raw.userId) {
    return {
      userAccessToken: IMPERSONATION_TOKEN,
      tokenExpiresAt: raw.tokenExpiresAt,
      userId: imp.id,
      userName: imp.name,
      impersonating: imp,
      realUserId: raw.userId,
      realUserName: raw.userName,
      isOwner,
    };
  }
  return {
    userAccessToken: raw.userAccessToken,
    tokenExpiresAt: raw.tokenExpiresAt,
    userId: raw.userId,
    userName: raw.userName,
    impersonating: null,
    realUserId: raw.userId,
    realUserName: raw.userName,
    isOwner,
  };
}

/** What AppShell needs to know about the owner, decided here on the server. */
export function shellState(s: AppSession): { isOwner: boolean; impersonatingName: string | null } {
  return { isOwner: s.isOwner, impersonatingName: s.impersonating?.name ?? null };
}
