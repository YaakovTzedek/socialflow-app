import { headers } from 'next/headers';

/**
 * Resolve the public base URL of the app.
 * Priority: explicit env var → Vercel URL → request host headers → localhost.
 */
export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, '');
  }
  // Prefer the actual request host (the stable domain the user is visiting)
  // over VERCEL_URL, which is the per-deployment URL and changes every deploy.
  const h = headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  if (host) {
    const proto =
      h.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    return `${proto}://${host}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
}

export function getRedirectUri(): string {
  return `${getBaseUrl()}/api/auth/callback`;
}
