import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, localePath, DEFAULT_LOCALE, LOCALES, type Locale } from '@/lib/i18n';
import { alternatesFor, urlFor } from '@/lib/seo';
import { slugFor } from '@/lib/slugs';
import { PublicShell } from '@/components/PublicShell';
import { Body, CompareTable, Cta, Faq, JsonLd, Related, Sources, Tldr, pageJsonLd } from '@/components/ManychatBlocks';
import { manychatAlternativeFor } from '@/content/manychat-alternative';
import { MC_CHECKED } from '@/content/compare';

/**
 * SocialFlow as a ManyChat alternative. Replaces /vs/manychat (which now
 * redirects here). Hebrew has its own edition at /he/manychat, so this route
 * serves every locale except Hebrew; next.config.js sends /he/manychat-alternative there.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.filter((l) => l !== 'he').map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const locale: Locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  const c = manychatAlternativeFor();
  const url = urlFor(locale, '/manychat-alternative');
  return {
    title: c.metaTitle,
    description: c.description,
    keywords: c.keywords,
    alternates: { canonical: url, languages: alternatesFor('/manychat-alternative') },
    openGraph: { title: c.metaTitle, description: c.description, url, type: 'article' },
  };
}

export default function ManychatAlternativePage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale) || params.locale === 'he') notFound();
  const locale = params.locale;
  const c = manychatAlternativeFor();
  const p = (path: string) => localePath(locale, path);
  const href = (path: string) => (path.startsWith('/blog/') ? path : p(slugFor(locale, path)));
  const url = urlFor(locale, '/manychat-alternative');

  return (
    <PublicShell locale={locale} title={c.title} lead={c.lead}>
      <JsonLd data={pageJsonLd({ url, name: c.metaTitle, description: c.description, inLanguage: 'en', faqs: c.faqs, dateModified: MC_CHECKED.iso })} />
      <p className="sfp-meta"><time dateTime={MC_CHECKED.iso}>{c.checked}</time></p>
      <Tldr title={c.tldrTitle} lines={c.tldr} />
      <Body html={c.body1} />
      <CompareTable id="comparison" title={c.tableTitle} colUs={c.colUs} colThem={c.colThem} groups={c.groups} />
      <Body html={c.body2} />
      <Faq title={c.faqTitle} faqs={c.faqs} />
      <Sources title={c.sourcesTitle} note={c.sourcesNote} sources={c.sources} />
      <Cta title={c.ctaTitle} text={c.ctaText} primary={{ href: p('/'), label: c.ctaBtn }} secondary={{ href: p('/pricing'), label: c.ctaSecondary }} />
      <Related title={c.relatedTitle} links={c.related.map((r) => ({ href: href(r.path), label: r.label }))} />
    </PublicShell>
  );
}
