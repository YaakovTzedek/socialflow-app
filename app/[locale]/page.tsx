import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { Landing } from '@/components/Landing';
import { getMessages, localePath, type Locale } from '@/lib/i18n';
import { landingJsonLd } from '@/lib/seo';
import { countClick, isValidCode } from '@/lib/affiliates';
import { hasDb } from '@/lib/db';
import '../landing.css';

// Logged-out root = the public landing page. A live session goes straight to the app.
export default async function Home({ params, searchParams }: { params: { locale: Locale }; searchParams: { error?: string; aff?: string } }) {
  const session = await getSession();
  if (session.userAccessToken) redirect(localePath(params.locale, '/dashboard'));

  // A visit through a partner link. The middleware already stored the cookie;
  // this is only the counter, so a failure here must not affect the page.
  if (hasDb && isValidCode(searchParams.aff)) {
    try { await countClick(searchParams.aff); } catch { /* counting is not worth an error page */ }
  }

  return (
    <>
      {/* The organisation, product and FAQ graph belongs to this page, not to
          every page under the locale layout: an FAQPage on a page that shows no
          FAQ is markup that does not match what the visitor sees. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(landingJsonLd(params.locale, getMessages(params.locale))) }}
      />
      <Landing error={searchParams.error} />
    </>
  );
}
