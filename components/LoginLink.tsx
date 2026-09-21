'use client';

import { useEffect, useState } from 'react';
import { useI18n } from './I18nProvider';

/**
 * Plain anchor to the Facebook login. A client-side navigation to the OAuth
 * URL opens the Facebook app on phones and strands the flow, so this is a real
 * link; on mobile it opens in a new tab so the app tab keeps the session.
 * The locale rides along so the callback lands on the right language.
 */
export function LoginLink({ children, className }: { children: React.ReactNode; className?: string }) {
  const { locale, p } = useI18n();
  const [mobile, setMobile] = useState(false);
  useEffect(() => { setMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)); }, []);
  const href = `/api/auth/login?next=${encodeURIComponent(p('/dashboard'))}&locale=${locale}`;
  return <a href={href} className={className} target={mobile ? '_blank' : undefined} rel={mobile ? 'noopener' : undefined}>{children}</a>;
}
