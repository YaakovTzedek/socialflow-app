import type { Locale } from '@/lib/i18n/config';

/**
 * Pages whose slug differs by language, keyed by the English path.
 *
 * The ManyChat alternative page is `/manychat-alternative` everywhere except
 * Hebrew, where people search the bare brand name, so the Hebrew edition lives
 * at `/he/manychat`. Links, canonicals, hreflang and the sitemap all go
 * through slugFor, so every locale points at the one URL that actually serves.
 */
export const LOCALIZED_SLUGS: Record<string, Partial<Record<Locale, string>>> = {
  '/manychat-alternative': { he: '/manychat' },
};

export function slugFor(locale: Locale, path: string): string {
  return LOCALIZED_SLUGS[path]?.[locale] ?? path;
}

/** Footer label for the ManyChat pricing page. English everywhere but Hebrew, like the page itself. */
export function manychatPricingNav(locale: Locale): string {
  return locale === 'he' ? 'מחירי ManyChat' : 'ManyChat pricing';
}
