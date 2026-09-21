import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import '../globals.css';
import '../app.css';
import { I18nProvider } from '@/components/I18nProvider';
import { LOCALES, DEFAULT_LOCALE, FONT_LINKS, FONT_STACK, dirOf, getMessages, isLocale, prefixOf, type Locale } from '@/lib/i18n';
import { landingJsonLd } from '@/lib/seo';

const BASE = (process.env.NEXT_PUBLIC_BASE_URL || 'https://isocialflow.com').replace(/\/$/, '');

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const locale: Locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  const m = getMessages(locale);
  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = `${BASE}${prefixOf(l) || '/'}`;
  languages['x-default'] = `${BASE}/`;
  return {
    metadataBase: new URL(BASE),
    title: m.meta.title,
    description: m.meta.description,
    alternates: { canonical: `${BASE}${prefixOf(locale) || '/'}`, languages },
    openGraph: { title: m.meta.title, description: m.meta.description, url: `${BASE}${prefixOf(locale) || '/'}`, locale, siteName: 'SocialFlow', type: 'website' },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large', 'max-video-preview': -1 } },
  };
}

export default function LocaleLayout({ children, params }: { children: React.ReactNode; params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale;
  const messages = getMessages(locale);
  const fonts = FONT_STACK[locale];
  return (
    <html lang={locale} dir={dirOf(locale)} style={{ ['--font-display' as any]: fonts.display, ['--font-body' as any]: fonts.body }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={FONT_LINKS[locale]} rel="stylesheet" />
      </head>
      <body className="font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(landingJsonLd(locale, messages)) }}
        />
        <I18nProvider locale={locale} messages={messages}>{children}</I18nProvider>
      </body>
    </html>
  );
}
