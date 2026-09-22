import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMessages, isLocale, localePath, prefixOf, DEFAULT_LOCALE, LOCALES, type Locale } from '@/lib/i18n';
import { postBySlug, postsFor, translationsOf } from '@/lib/blog';
import { SEO_BASE } from '@/lib/seo';
import { PublicShell } from '@/components/PublicShell';

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => postsFor(locale).map((post) => ({ locale, slug: post.slug })));
}

export async function generateMetadata({ params }: { params: { locale: string; slug: string } }): Promise<Metadata> {
  const locale: Locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  const post = postBySlug(locale, params.slug);
  if (!post) return {};
  const url = `${SEO_BASE}${prefixOf(locale)}/blog/${post.slug}`;
  // Only real translations get an hreflang entry.
  const languages: Record<string, string> = {};
  for (const sibling of translationsOf(post)) languages[sibling.locale] = `${SEO_BASE}${prefixOf(sibling.locale)}/blog/${sibling.slug}`;
  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: url, languages },
    openGraph: { title: post.title, description: post.description, url, type: 'article', publishedTime: post.published, modifiedTime: post.updated || post.published },
  };
}

export default function BlogArticle({ params }: { params: { locale: string; slug: string } }) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale;
  const post = postBySlug(locale, params.slug);
  if (!post) notFound();
  const m = getMessages(locale);
  const p = (path: string) => localePath(locale, path);
  const url = `${SEO_BASE}${prefixOf(locale)}/blog/${post.slug}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': `${url}#article`,
        headline: post.title,
        description: post.description,
        inLanguage: locale,
        datePublished: post.published,
        dateModified: post.updated || post.published,
        keywords: post.keywords.join(', '),
        mainEntityOfPage: url,
        author: { '@type': 'Organization', name: 'SocialFlow', url: `${SEO_BASE}/` },
        publisher: { '@id': `${SEO_BASE}/#organization` },
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        inLanguage: locale,
        mainEntity: post.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      },
    ],
  };

  const others = postsFor(locale).filter((x) => x.slug !== post.slug).slice(0, 3);

  return (
    <PublicShell locale={locale} title={post.title} lead={post.description} back={{ href: p('/blog'), label: m.blog.backToIndex }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="sfp-tldr">
        <div className="sfp-tldr-title">{m.blog.tldr}</div>
        <ul>{post.tldr.map((line) => <li key={line}>{line}</li>)}</ul>
      </div>

      <article className="sfp-body" dangerouslySetInnerHTML={{ __html: post.body }} />

      <section className="sfp-faq">
        <h2>{m.blog.faqTitle}</h2>
        {post.faq.map((f) => (
          <div key={f.q} className="sfp-faq-item">
            <h3>{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}
      </section>

      <div className="sfp-cta">
        <div className="sfp-cta-title">{m.blog.ctaTitle}</div>
        <p>{m.blog.ctaText}</p>
        <Link href={p('/')} className="sf-btn sf-btn-primary">{m.beta.navCta}</Link>
      </div>

      {others.length > 0 && (
        <section className="sfp-more">
          <h2>{m.blog.more}</h2>
          <div className="sfp-posts">
            {others.map((o) => (
              <Link key={o.slug} href={p(`/blog/${o.slug}`)} className="sfp-post">
                <h2>{o.title}</h2>
                <p>{o.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </PublicShell>
  );
}
