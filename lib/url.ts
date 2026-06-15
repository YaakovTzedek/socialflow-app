import { headers } from 'next/headers';

/**
 * Resolve the public base URL of the app.
 * Priority: explicit env var → Vercel URL → request host headers → localhost.
 */
export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  const h = headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  const proto = h.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
  if (host) return `${proto}://${host}`;
  return 'http://localhost:3000';
}

export function getRedirectUri(): string {
  return `${getBaseUrl()}/api/auth/callback`;
}
