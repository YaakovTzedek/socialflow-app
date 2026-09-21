'use client';

import { usePathname, useRouter } from 'next/navigation';
import { LOCALES, LOCALE_NAMES, localePath, splitPath, type Locale } from '@/lib/i18n/config';
import { useI18n } from './I18nProvider';

/** Switches the locale while keeping the current page. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, m } = useI18n();
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { rest } = splitPath(pathname);
  return (
    <label className={`sfa-lang ${className || ''}`} aria-label={m.common.language}>
      <select value={locale} onChange={(e) => router.push(localePath(e.target.value as Locale, rest))}>
        {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
      </select>
    </label>
  );
}
