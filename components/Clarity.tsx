'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { LOCALES } from '@/lib/i18n';

/**
 * Microsoft Clarity (heatmaps + session replays) on the public marketing pages only, to see why landing
 * visitors leave without joining the beta (6.10.2026: 56 affiliate clicks, 0 sign-ups). Never on the
 * signed-in app (dashboard, inbox, automations...), which shows customers' comments and DMs.
 */
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID || 'ytf05m2lgl';
const PUBLIC = new Set(['', 'blog', 'guide', 'pricing', 'instagram-auto-responder', 'manychat', 'manychat-alternative', 'manychat-pricing', 'privacy', 'terms', 'mcp']);

export function isPublicPath(pathname: string): boolean {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length && (LOCALES as readonly string[]).includes(parts[0])) parts.shift();
  return PUBLIC.has(parts[0] || '');
}

export function Clarity() {
  const pathname = usePathname() || '/';
  if (!CLARITY_ID || !isPublicPath(pathname)) return null;
  return (
    <Script id="ms-clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${CLARITY_ID}");`}
    </Script>
  );
}
