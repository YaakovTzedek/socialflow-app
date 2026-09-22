import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, prefixOf, DEFAULT_LOCALE, LOCALES, getMessages, type Locale } from '@/lib/i18n';
import { SEO_BASE } from '@/lib/seo';
import { PublicShell } from '@/components/PublicShell';
import { BetaForm } from '@/components/BetaForm';
import { GuideToc } from '@/components/GuideToc';
import { guideFor } from '@/content/guide';

/**
 * The page the private message points at. Someone comments a keyword on a post,
 * the automation runs on them, and this is where they land seconds later.
 *
 * It exists to be worth the click on its own: the method first, the product at
 * the end. The waiting list form is the only ask, and it sits below the guide
 * rather than in front of it.
 */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const locale: Locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  const g = guideFor(locale);
  const url = `${SEO_BASE}${prefixOf(locale)}/guide`;
  return {
    title: g.title,
    description: g.description,
    keywords: g.keywords,
    alternates: { canonical: url },
    openGraph: { title: g.title, description: g.description, url, type: 'article' },
  };
}

export default function GuidePage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale;
  const m = getMessages(locale);
  const g = guideFor(locale);
  const url = `${SEO_BASE}${prefixOf(locale)}/guide`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    '@id': `${url}#guide`,
    name: g.title,
    description: g.description,
    inLanguage: locale,
    url,
  };

  return (
    <PublicShell locale={locale} title={g.title} lead={g.lead}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="sfp-tldr">
        <div className="sfp-tldr-title">{m.blog.tldr}</div>
        <ul>{g.tldr.map((line) => <li key={line}>{line}</li>)}</ul>
      </div>

      <div className="sfg-wrap">
        <article className="sfp-body sfg-body" dangerouslySetInnerHTML={{ __html: g.body }} />
        <GuideToc title={g.tocTitle} sections={g.sections} />
      </div>

      <section className="sfp-guide-cta" id="join">
        <h2>{g.ctaTitle}</h2>
        <p>{g.ctaText}</p>
        <BetaForm />
      </section>
    </PublicShell>
  );
}
