import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { Landing } from '@/components/Landing';
import { localePath, type Locale } from '@/lib/i18n';
import '../landing.css';

// Logged-out root = the public landing page. A live session goes straight to the app.
export default async function Home({ params, searchParams }: { params: { locale: Locale }; searchParams: { error?: string } }) {
  const session = await getSession();
  if (session.userAccessToken) redirect(localePath(params.locale, '/dashboard'));
  return <Landing error={searchParams.error} />;
}
