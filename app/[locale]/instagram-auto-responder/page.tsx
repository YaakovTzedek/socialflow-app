import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, prefixOf, DEFAULT_LOCALE, LOCALES, type Locale } from '@/lib/i18n';
import { SEO_BASE, alternatesFor } from '@/lib/seo';
import { PublicShell } from '@/components/PublicShell';
import { BetaForm } from '@/components/BetaForm';
import { GuideToc } from '@/components/GuideToc';
import { autoResponderFor } from '@/content/instagram-auto-responder';

/**
 * The flagship page for "instagram auto responder" (content plan, page 1).
 *
 * Answer first, then the definition, the mechanism, the setup with real
 * screens, Meta's rules with links to Meta's own docs, and prices read from
 * the plan catalog. The waiting list form is the only ask, at the end.
 */
const PATH = '/instagram-auto-responder';

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const locale: Locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  const a = autoResponderFor(locale);
  const url = `${SEO_BASE}${prefixOf(locale)}${PATH}`;
  return {
    title: a.metaTitle,
    description: a.description,
    keywords: a.keywords,
    alternates: { canonical: url, languages: alternatesFor(PATH) },
    openGraph: { title: a.metaTitle, description: a.description, url, type: 'article' },
  };
}

export default function AutoResponderPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale;
  const a = autoResponderFor(locale);
  const url = `${SEO_BASE}${prefixOf(locale)}${PATH}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: a.metaTitle,
        description: a.description,
        inLanguage: locale,
        isPartOf: { '@id': `${SEO_BASE}/#website` },
        about: { '@id': `${SEO_BASE}/#software` },
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        inLanguage: locale,
        mainEntity: a.faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };

  return (
    <PublicShell locale={locale} title={a.title} lead={a.lead}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="sfp-tldr">
        <div className="sfp-tldr-title">{a.answerTitle}</div>
        {a.answer.map((line) => <p key={line} className="sfa-answer">{line}</p>)}
      </div>

      <div className="sfg-wrap">
        <article className="sfp-body sfg-body" dangerouslySetInnerHTML={{ __html: a.body }} />
        <GuideToc title={a.tocTitle} sections={a.sections} />
      </div>

      <section className="sfp-faq">
        <h2>{a.faqTitle}</h2>
        {a.faqs.map((f) => (
          <div className="sfp-faq-item" key={f.q}>
            <h3>{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}
      </section>

      <section className="sfc-sources">
        <h2>{a.sourcesTitle}</h2>
        <p>{a.sourcesNote}</p>
        <ul>
          {a.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener">{s.label}</a>
            </li>
          ))}
        </ul>
      </section>

      <section className="sfp-guide-cta" id="join">
        <h2>{a.ctaTitle}</h2>
        <p>{a.ctaText}</p>
        <BetaForm />
      </section>
    </PublicShell>
  );
}
