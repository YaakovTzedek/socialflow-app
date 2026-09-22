import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMessages, isLocale, localePath, DEFAULT_LOCALE, type Locale } from '@/lib/i18n';
import { postsFor } from '@/lib/blog';
import { SEO_BASE, alternatesFor } from '@/lib/seo';
import { PublicShell } from '@/components/PublicShell';

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const locale: Locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  const m = getMessages(locale);
  const url = `${SEO_BASE}${locale === DEFAULT_LOCALE ? '' : `/${locale}`}/blog`;
  return {
    title: m.blog.indexTitle,
    description: m.blog.indexDescription,
    alternates: { canonical: url, languages: alternatesFor('/blog') },
    openGraph: { title: m.blog.indexTitle, description: m.blog.indexDescription, url, type: 'website' },
  };
}

export default function BlogIndex({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale;
  const m = getMessages(locale);
  const posts = postsFor(locale);
  const p = (path: string) => localePath(locale, path);

  return (
    <PublicShell locale={locale} title={m.blog.indexTitle} lead={m.blog.indexDescription}>
      {posts.length === 0 ? (
        <p className="sfp-muted">{m.blog.empty}</p>
      ) : (
        <div className="sfp-posts">
          {posts.map((post) => (
            <Link key={post.slug} href={p(`/blog/${post.slug}`)} className="sfp-post">
              <h2>{post.title}</h2>
              <p>{post.description}</p>
              <span className="sfp-meta">{post.published} · {m.blog.readingTime.replace('{minutes}', String(post.readingMinutes))}</span>
            </Link>
          ))}
        </div>
      )}
    </PublicShell>
  );
}
