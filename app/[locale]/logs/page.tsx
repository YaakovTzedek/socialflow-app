import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSession, shellState } from '@/lib/session';
import { touchSeen } from '@/lib/audit';
import AppShell from '@/components/AppShell';
import LogsScreen from '@/components/LogsScreen';
import { getMessages, localePath, type Locale } from '@/lib/i18n';

export default async function Page({ params }: { params: { locale: Locale } }) {
  const session = await getSession();
  if (!session.userAccessToken) redirect(localePath(params.locale, '/'));
  // Last seen is the customer's own visit; the owner viewing as them does not count.
  if (!session.impersonating) await touchSeen(session.userId, session.userName);
  const m = getMessages(params.locale);
  const userName = session.userName || m.common.user;
  return (
    <AppShell owner={shellState(session)} userName={userName} title={m.nav.logs}>
      <Suspense fallback={null}><LogsScreen /></Suspense>
    </AppShell>
  );
}
