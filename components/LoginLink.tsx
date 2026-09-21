'use client';

import { useEffect, useState } from 'react';

/**
 * Plain <a> to /api/auth/login (server 307 to Facebook).
 * Not a next/link: the router follows the redirect with a JS navigation, and on
 * iPhone/Android that hands facebook.com to the Facebook app (universal link),
 * which never returns to our callback. A plain tap stays in the browser; on touch
 * devices we also open a new tab, which is what proved to work on Yaakov's phone.
 */
export function LoginLink({ className, children }: { className?: string; children: React.ReactNode }) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  }, []);
  return (
    <a href="/api/auth/login" className={className} target={mobile ? '_blank' : undefined} rel={mobile ? 'noopener' : undefined}>
      {children}
    </a>
  );
}
