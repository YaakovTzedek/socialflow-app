import en, { type Messages } from './messages/en';
import he from './messages/he';
import ar from './messages/ar';
import hu from './messages/hu';
import de from './messages/de';
import fr from './messages/fr';
import it from './messages/it';
import ja from './messages/ja';
import es from './messages/es';
import { DEFAULT_LOCALE, INTL_TAG, isLocale, type Locale } from './config';

export * from './config';
export type { Messages };

const REGISTRY: Record<Locale, Messages> = { en, he, ar, hu, de, fr, it, ja, es };

export function getMessages(locale: string | undefined | null): Messages {
  return REGISTRY[isLocale(locale) ? locale : DEFAULT_LOCALE];
}

/** Replace {name} placeholders. */
export function fmt(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export function intlTag(locale: string | undefined | null): string {
  return INTL_TAG[isLocale(locale) ? locale : DEFAULT_LOCALE];
}

export function formatDate(locale: string | undefined | null, iso: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString(intlTag(locale), opts); } catch { return String(iso); }
}

export function formatDateTime(locale: string | undefined | null, iso: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString(intlTag(locale), opts); } catch { return String(iso); }
}

export function formatNumber(locale: string | undefined | null, n: number): string {
  try { return n.toLocaleString(intlTag(locale)); } catch { return String(n); }
}
