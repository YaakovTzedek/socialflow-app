import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, localePath, DEFAULT_LOCALE, LOCALES, type Locale } from '@/lib/i18n';
import { alternatesFor, urlFor } from '@/lib/seo';
import { slugFor } from '@/lib/slugs';
import { PublicShell } from '@/components/PublicShell';
import { Body, Cta, Faq, JsonLd, Related, Sources, Tldr, pageJsonLd } from '@/components/ManychatBlocks';
import { manychatPricingFor } from '@/content/manychat-pricing';
import { MC_CHECKED } from '@/content/compare';

/**
 * ManyChat pricing, explained with ManyChat's own numbers and a worked
 * example, then how SocialFlow prices the same job. Hebrew in Hebrew, English
 * for every other locale.
 */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const locale: Locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  const c = manychatPricingFor(locale);
  const url = urlFor(locale, '/manychat-pricing');
  return {
    title: c.metaTitle,
    description: c.description,
    keywords: c.keywords,
    alternates: { canonical: url, languages: alternatesFor('/manychat-pricing') },
    openGraph: { title: c.metaTitle, description: c.description, url, type: 'article' },
  };
}

function Table({ title, head, rows, note }: { title: string; head: string[]; rows: string[][]; note?: string }) {
  return (
    <section className="sfp-body" style={{ maxWidth: 'none' }}>
      <h2>{title}</h2>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]}>{r.map((cell, i) => (i === 0 ? <th key={i} scope="row">{cell}</th> : <td key={i}>{cell}</td>))}</tr>
            ))}
          </tbody>
        </table>
      </div>
      {note && <p style={{ fontSize: 14 }}>{note}</p>}
    </section>
  );
}

export default function ManychatPricingPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale;
  const c = manychatPricingFor(locale);
  const lang = locale === 'he' ? 'he' : 'en';
  const p = (path: string) => localePath(locale, path);
  const href = (path: string) => (path.startsWith('/blog/') ? localePath(lang, path) : p(slugFor(locale, path)));
  const url = urlFor(locale, '/manychat-pricing');

  return (
    <PublicShell locale={locale} title={c.title} lead={c.lead}>
      <JsonLd data={pageJsonLd({ url, name: c.metaTitle, description: c.description, inLanguage: lang, faqs: c.faqs, dateModified: MC_CHECKED.iso })} />
      <p className="sfp-meta"><time dateTime={MC_CHECKED.iso}>{c.checked}</time></p>
      <Tldr title={c.tldrTitle} lines={c.tldr} />
      <Table title={c.tiersTitle} head={c.tiersHead} rows={c.tiers} note={c.tiersNote} />
      <Body html={c.body1} />
      <Table title={c.exampleTitle} head={c.exampleHead} rows={c.example} note={c.exampleNote} />
      <Body html={c.body2} />
      <Table title={c.usTitle} head={c.usHead} rows={c.us} />
      <Body html={c.body3} />
      <Faq title={c.faqTitle} faqs={c.faqs} />
      <Sources title={c.sourcesTitle} note={c.sourcesNote} sources={c.sources} />
      <Cta title={c.ctaTitle} text={c.ctaText} primary={{ href: p('/'), label: c.ctaBtn }} secondary={{ href: p('/pricing'), label: c.ctaSecondary }} />
      <Related title={c.relatedTitle} links={c.related.map((r) => ({ href: href(r.path), label: r.label }))} />
    </PublicShell>
  );
}
