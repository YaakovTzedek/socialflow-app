import { LOCALES, prefixOf, type Locale } from '@/lib/i18n';
import type { Messages } from '@/lib/i18n/messages/en';
import { PLAN_CATALOG, type PlanId } from '@/lib/plans';
import { slugFor } from '@/lib/slugs';

export const SEO_BASE = (process.env.NEXT_PUBLIC_BASE_URL || 'https://isocialflow.com').replace(/\/$/, '');

/** Public pages, in sitemap order. Everything else needs a session. */
export const PUBLIC_PATHS = ['/', '/pricing', '/guide', '/manychat-alternative', '/manychat-pricing', '/blog', '/terms', '/privacy', '/data-deletion'] as const;

export function urlFor(locale: Locale, path: string) {
  const p = path === '/' ? '' : slugFor(locale, path);
  return `${SEO_BASE}${prefixOf(locale)}${p}` || `${SEO_BASE}/`;
}

/** hreflang map for one path across every locale, x-default pointing at English. */
export function alternatesFor(path: string) {
  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = urlFor(l, path);
  languages['x-default'] = urlFor('en', path);
  return languages;
}

const SELLABLE: PlanId[] = ['free', 'creator', 'pro', 'agency'];

/**
 * Structured data for the landing page: the organization, the site, the product
 * with its real prices, and the FAQ (the block answer engines quote from).
 * Every value comes from the message files or the plan catalog, so a locale
 * change moves the markup with the page.
 */
export function landingJsonLd(locale: Locale, m: Messages) {
  const home = urlFor(locale, '/');
  const currency = locale === 'he' ? 'ILS' : 'USD';
  const offers = SELLABLE.map((id) => {
    const plan = PLAN_CATALOG[id];
    const price = currency === 'ILS' ? plan.priceIls : plan.priceUsd;
    return {
      '@type': 'Offer',
      name: `SocialFlow ${plan.name}`,
      price: String(price),
      priceCurrency: currency,
      availability: 'https://schema.org/InStock',
      url: home,
      ...(price > 0 ? { priceSpecification: { '@type': 'UnitPriceSpecification', price: String(price), priceCurrency: currency, billingDuration: 1, billingIncrement: 1, unitCode: 'MON' } } : {}),
    };
  });

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SEO_BASE}/#organization`,
        name: 'SocialFlow',
        url: `${SEO_BASE}/`,
        founder: { '@type': 'Person', name: 'Yaakov Tzedek', url: 'https://tzedek.me' },
      },
      {
        '@type': 'WebSite',
        '@id': `${SEO_BASE}/#website`,
        url: `${SEO_BASE}/`,
        name: 'SocialFlow',
        inLanguage: LOCALES,
        publisher: { '@id': `${SEO_BASE}/#organization` },
      },
      {
        '@type': 'WebPage',
        '@id': `${home}#webpage`,
        url: home,
        name: m.meta.title,
        description: m.meta.description,
        inLanguage: locale,
        isPartOf: { '@id': `${SEO_BASE}/#website` },
        about: { '@id': `${SEO_BASE}/#software` },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SEO_BASE}/#software`,
        name: 'SocialFlow',
        url: `${SEO_BASE}/`,
        applicationCategory: 'BusinessApplication',
        applicationSubCategory: 'Marketing automation',
        operatingSystem: 'Web',
        description: m.meta.description,
        inLanguage: locale,
        publisher: { '@id': `${SEO_BASE}/#organization` },
        featureList: m.landing.features.map((f) => f.title),
        offers,
      },
      {
        '@type': 'FAQPage',
        '@id': `${home}#faq`,
        inLanguage: locale,
        mainEntity: m.landing.faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };
}
