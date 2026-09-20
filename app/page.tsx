import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { Landing } from '@/components/Landing';
import './landing.css';

// Logged-out root = the public landing page (design: Claude Design project
// be3e4d06, "SocialFlow Landing"). A live session goes straight to the app.
export default async function Home({ searchParams }: { searchParams: { error?: string } }) {
  const session = await getSession();
  if (session.userAccessToken) redirect('/dashboard');
  return <Landing error={searchParams.error} />;
}
