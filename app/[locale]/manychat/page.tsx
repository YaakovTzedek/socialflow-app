import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMessages, localePath } from '@/lib/i18n';
import { alternatesFor, urlFor } from '@/lib/seo';
import { PublicShell } from '@/components/PublicShell';
import { Body, CompareTable, Cta, Faq, JsonLd, Related, Sources, Tldr, pageJsonLd } from '@/components/ManychatBlocks';
import { compareFor, MC_CHECKED } from '@/content/compare';

/**
 * /he/manychat: the Hebrew edition of the ManyChat page. Hebrew searchers type
 * the bare brand name (and its transliterations), so this is where the Hebrew
 * comparison lives; /he/vs/manychat redirects here. Every other locale's
 * edition is /manychat-alternative, and next.config.js redirects /<locale>/manychat there.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ locale: 'he' }];
}

export async function generateMetadata(): Promise<Metadata> {
  const c = compareFor('he');
  const url = urlFor('he', '/manychat-alternative');
  return {
    title: c.metaTitle,
    description: c.description,
    keywords: c.keywords,
    alternates: { canonical: url, languages: alternatesFor('/manychat-alternative') },
    openGraph: { title: c.metaTitle, description: c.description, url, type: 'article' },
  };
}

export default function ManychatHebrewPage({ params }: { params: { locale: string } }) {
  if (params.locale !== 'he') notFound();
  const locale = 'he' as const;
  const m = getMessages(locale);
  const c = compareFor(locale);
  const p = (path: string) => localePath(locale, path);
  const url = urlFor(locale, '/manychat-alternative');
  const [intro, rest = ''] = c.body.split('<!--table-->');
  const checked = `המחירים נבדקו ב-${MC_CHECKED.he}. המקורות בתחתית העמוד.`;

  return (
    <PublicShell locale={locale} title={c.title} lead={c.lead}>
      <JsonLd data={pageJsonLd({ url, name: c.metaTitle, description: c.description, inLanguage: 'he', faqs: c.faqs, dateModified: MC_CHECKED.iso })} />
      <p className="sfp-meta"><time dateTime={MC_CHECKED.iso}>{checked}</time></p>
      <Tldr title={m.blog.tldr} lines={c.tldr} />
      <Body html={intro} />
      <CompareTable id="comparison" title={c.tableTitle} colUs={c.colUs} colThem={c.colThem} groups={c.groups} />
      <Body html={rest} />
      <Faq title={c.faqTitle} faqs={c.faqs} />
      <Sources title={c.sourcesTitle} note={c.sourcesNote} sources={c.sources} />
      <Cta title={c.ctaTitle} text={c.ctaText} primary={{ href: p('/'), label: c.ctaBtn }} secondary={{ href: p('/pricing'), label: m.pricing.nav }} />
      <Related
        title="עוד בנושא"
        links={[
          { href: p('/manychat-pricing'), label: 'מחירי ManyChat ב-2026: כמה זה עולה באמת' },
          { href: p('/instagram-auto-responder'), label: 'מענה אוטומטי לתגובות באינסטגרם' },
          { href: p('/pricing'), label: 'המחירים של SocialFlow' },
          { href: p('/guide'), label: 'המדריך המלא' },
          { href: p('/blog/manychat-alternatives-hebrew'), label: 'האלטרנטיבות ל-ManyChat בעברית' },
        ]}
      />
    </PublicShell>
  );
}
