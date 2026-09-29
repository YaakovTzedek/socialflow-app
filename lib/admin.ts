import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { getRawSession } from './session';
import { isOwnerId } from './owner';

/**
 * Admin gate for the owner's private panel.
 *
 * Deliberately separate from the Facebook login: the panel has to be reachable
 * from any device without going through Meta, and it reads across every
 * account, which a normal session must never do. A signed cookie holds the
 * expiry, so the code itself is typed once and never stored in the browser.
 */
const COOKIE = 'sf_admin';
const TTL_DAYS = 30;

function secret(): string {
  return process.env.SESSION_SECRET || process.env.ADMIN_CLAIM_CODE || '';
}

function sign(exp: number): string {
  return createHmac('sha256', secret()).update(String(exp)).digest('hex');
}

export function adminCookieValue(): { name: string; value: string; maxAge: number } {
  const exp = Date.now() + TTL_DAYS * 86400_000;
  return { name: COOKIE, value: `${exp}.${sign(exp)}`, maxAge: TTL_DAYS * 86400 };
}

export function adminCookieName() { return COOKIE; }

/** Constant-time comparison, so a wrong cookie cannot be guessed byte by byte. */
function sameSignature(a: string, b: string): boolean {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function verifyAdminCookie(raw: string | undefined): boolean {
  if (!raw || !secret()) return false;
  const [expStr, sig] = raw.split('.');
  const exp = Number(expStr);
  if (!exp || !sig || exp < Date.now()) return false;
  try { return sameSignature(sig, sign(exp)); } catch { return false; }
}

/** The code cookie alone. Prefer isAdminRequest(), which also admits the signed-in owner. */
export function hasAdminCookie(): boolean {
  return verifyAdminCookie(cookies().get(COOKIE)?.value);
}

/**
 * The signed-in Facebook user is the SaaS owner (lib/owner.ts). Reads the raw
 * session, never the impersonated view, so it answers for the real person.
 */
export async function isOwnerRequest(): Promise<boolean> {
  try {
    const raw = await getRawSession();
    return !!raw.userAccessToken && isOwnerId(raw.userId);
  } catch { return false; }
}

/** Admin area access: the owner's own Facebook session, or the code cookie. */
export async function isAdminRequest(): Promise<boolean> {
  if (hasAdminCookie()) return true;
  return isOwnerRequest();
}

/** The code typed on the gate. Same one the claim and diagnostics links use. */
export function codeMatches(code: string): boolean {
  const expected = process.env.ADMIN_CLAIM_CODE;
  if (!expected || !code || code.length !== expected.length) return false;
  try { return sameSignature(code, expected); } catch { return false; }
}
