'use client';

import { createContext, useContext, useMemo } from 'react';
import { fmt, formatDate, formatDateTime, formatNumber, localePath, dirOf, type Locale, type Messages } from '@/lib/i18n';

interface Ctx { locale: Locale; m: Messages }
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, m: messages }), [locale, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Messages + helpers for client components. */
export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n outside I18nProvider');
  const { locale, m } = ctx;
  return {
    locale, m, dir: dirOf(locale),
    t: fmt,
    p: (path: string) => localePath(locale, path),
    date: (iso: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions) => formatDate(locale, iso, opts),
    dateTime: (iso: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions) => formatDateTime(locale, iso, opts),
    num: (n: number) => formatNumber(locale, n),
  };
}
