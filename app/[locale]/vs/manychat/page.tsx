import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale, localePath, prefixOf, DEFAULT_LOCALE, LOCALES, getMessages, type Locale } from '@/lib/i18n';
import { SEO_BASE, alternatesFor } from '@/lib/seo';
import { PublicShell } from '@/components/PublicShell';
import { compareFor } from '@/content/compare';

/**
 * The comparison page. Someone searching "ManyChat alternative" or "ManyChat
 * in Hebrew" lands here, and the only way this page earns the click is by
 * being checkable: every ManyChat number carries a source and a date, and the
 * section on what ManyChat does better is not decoration.
 */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const locale: Locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  const c = compareFor(locale);
  const url = `${SEO_BASE}${prefixOf(locale)}/vs/manychat`;
  return {
    title: c.metaTitle,
    description: c.description,
    keywords: c.keywords,
    alternates: { canonical: url, languages: alternatesFor('/vs/manychat') },
    openGraph: { title: c.metaTitle, description: c.description, url, type: 'article' },
  };
}

export default function ComparePage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale;
  const m = getMessages(locale);
  const c = compareFor(locale);
  const p = (path: string) => localePath(locale, path);
  const url = `${SEO_BASE}${prefixOf(locale)}/vs/manychat`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: c.metaTitle,
        description: c.description,
        inLanguage: locale,
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        inLanguage: locale,
        mainEntity: c.faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };

  return (
    <PublicShell locale={locale} title={c.title} lead={c.lead}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="sfp-tldr">
        <div className="sfp-tldr-title">{m.blog.tldr}</div>
        <ul>{c.tldr.map((line) => <li key={line}>{line}</li>)}</ul>
      </div>

      <section className="sfc">
        <h2 className="sfc-title">{c.tableTitle}</h2>
        <div className="sfc-scroll">
          <table className="sfc-table">
            <thead>
              <tr>
                <th />
                <th className="sfc-us">{c.colUs}</th>
                <th>{c.colThem}</th>
              </tr>
            </thead>
            {c.groups.map((g) => (
              <tbody key={g.title}>
                <tr className="sfc-group">
                  <th colSpan={3} scope="colgroup">{g.title}</th>
                </tr>
                {g.rows.map((r) => (
                  <tr key={r.label} className={r.key ? 'sfc-key' : undefined}>
                    <th scope="row">{r.label}</th>
                    <td className="sfc-us">{r.us}</td>
                    <td>{r.them}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </section>

      <article className="sfp-body" dangerouslySetInnerHTML={{ __html: c.body }} />

      <section className="sfp-faq">
        <h2>{c.faqTitle}</h2>
        {c.faqs.map((f) => (
          <div className="sfp-faq-item" key={f.q}>
            <h3>{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}
      </section>

      <section className="sfc-sources">
        <h2>{c.sourcesTitle}</h2>
        <p>{c.sourcesNote}</p>
        <ul>
          {c.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener nofollow">{s.label}</a>
            </li>
          ))}
        </ul>
      </section>

      <section className="sfp-cta">
        <div className="sfp-cta-title">{c.ctaTitle}</div>
        <p>{c.ctaText}</p>
        <div className="sfc-cta-row">
          <Link href={p('/')} className="sf-btn sf-btn-primary">{c.ctaBtn}</Link>
          <Link href={p('/pricing')} className="sf-btn sf-btn-ghost">{m.pricing.nav}</Link>
        </div>
      </section>
    </PublicShell>
  );
}
