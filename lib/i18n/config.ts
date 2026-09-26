/**
 * Locales: English is the default and lives at the bare path (/dashboard);
 * every other language has a prefix (/he/dashboard). Hebrew and Arabic are RTL.
 */
export const LOCALES = ['en', 'he', 'ar', 'hu', 'de', 'fr', 'it', 'ja', 'es'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const RTL_LOCALES: ReadonlySet<Locale> = new Set<Locale>(['he', 'ar']);

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English', he: 'עברית', ar: 'العربية', hu: 'Magyar', de: 'Deutsch', fr: 'Français', it: 'Italiano', ja: '日本語', es: 'Español',
};

/** BCP-47 tag for Intl formatting. */
export const INTL_TAG: Record<Locale, string> = {
  en: 'en-US', he: 'he-IL', ar: 'ar', hu: 'hu-HU', de: 'de-DE', fr: 'fr-FR', it: 'it-IT', ja: 'ja-JP', es: 'es-ES',
};

/** Sumit invoices are Hebrew or English only. */
export const INVOICE_LANG: Record<Locale, 'Hebrew' | 'English'> = {
  en: 'English', he: 'Hebrew', ar: 'English', hu: 'English', de: 'English', fr: 'English', it: 'English', ja: 'English', es: 'English',
};

export function isLocale(x: string | undefined | null): x is Locale {
  return !!x && (LOCALES as readonly string[]).includes(x);
}

export function dirOf(locale: Locale): 'rtl' | 'ltr' {
  return RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
}

/** Path prefix for a locale: '' for English, '/he' for Hebrew. */
export function prefixOf(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? '' : `/${locale}`;
}

/** Build a locale-aware path: localePath('he', '/dashboard') → '/he/dashboard'. */
export function localePath(locale: Locale, path: string): string {
  if (!path.startsWith('/')) path = '/' + path;
  if (path.startsWith('/api/') || path.startsWith('/.well-known')) return path;
  return `${prefixOf(locale)}${path === '/' && locale !== DEFAULT_LOCALE ? '' : path}` || '/';
}

/** Split a pathname into its locale and the rest. */
export function splitPath(pathname: string): { locale: Locale; rest: string } {
  const seg = pathname.split('/')[1];
  if (isLocale(seg)) return { locale: seg, rest: pathname.slice(seg.length + 1) || '/' };
  return { locale: DEFAULT_LOCALE, rest: pathname || '/' };
}

/** Pick the best locale from an Accept-Language header. */
export function negotiate(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const prefs = acceptLanguage.split(',').map((p) => p.trim().split(';')[0].toLowerCase().split('-')[0]);
  for (const p of prefs) if (isLocale(p)) return p;
  return DEFAULT_LOCALE;
}

/**
 * The explicit language choice from the language switcher. Unlike sf_locale
 * (which only records the last language a page was served in), this cookie is
 * written only when a person picks a language, so it always wins.
 */
export const PICK_COOKIE = 'sf_lang';

/** Signed-in app sections. Only these follow the browser language; marketing pages keep their URLs. */
export const APP_SECTIONS: ReadonlySet<string> = new Set([
  'dashboard', 'automations', 'posts', 'mcp', 'inbox', 'messages', 'brain', 'logs', 'billing', 'admin',
]);

export function isAppPath(rest: string): boolean {
  return APP_SECTIONS.has(rest.split(/[/?#]/)[1] || '');
}

/** The explicit pick if there is one, otherwise the browser language. */
export function preferredLocale(pick: string | undefined | null, acceptLanguage: string | null | undefined): Locale {
  return isLocale(pick) ? pick : negotiate(acceptLanguage);
}

/** Google Fonts per script. Karantina (Hebrew display) has no Latin/Arabic/Japanese glyphs. */
export const FONT_LINKS: Record<Locale, string> = {
  he: 'https://fonts.googleapis.com/css2?family=Karantina:wght@300;400;700&family=Assistant:wght@300;400;600;700;800&display=swap',
  ar: 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap',
  ja: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap',
  en: 'https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Assistant:wght@300;400;600;700;800&display=swap',
  hu: 'https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Assistant:wght@300;400;600;700;800&display=swap',
  de: 'https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Assistant:wght@300;400;600;700;800&display=swap',
  fr: 'https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Assistant:wght@300;400;600;700;800&display=swap',
  it: 'https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Assistant:wght@300;400;600;700;800&display=swap',
  es: 'https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Assistant:wght@300;400;600;700;800&display=swap',
};

export const FONT_STACK: Record<Locale, { display: string; body: string }> = {
  he: { display: 'Karantina, Assistant, sans-serif', body: 'Assistant, system-ui, sans-serif' },
  ar: { display: 'Cairo, system-ui, sans-serif', body: 'Cairo, system-ui, sans-serif' },
  ja: { display: '"Noto Sans JP", system-ui, sans-serif', body: '"Noto Sans JP", system-ui, sans-serif' },
  en: { display: 'Oswald, Assistant, sans-serif', body: 'Assistant, system-ui, sans-serif' },
  hu: { display: 'Oswald, Assistant, sans-serif', body: 'Assistant, system-ui, sans-serif' },
  de: { display: 'Oswald, Assistant, sans-serif', body: 'Assistant, system-ui, sans-serif' },
  fr: { display: 'Oswald, Assistant, sans-serif', body: 'Assistant, system-ui, sans-serif' },
  it: { display: 'Oswald, Assistant, sans-serif', body: 'Assistant, system-ui, sans-serif' },
  es: { display: 'Oswald, Assistant, sans-serif', body: 'Assistant, system-ui, sans-serif' },
};
