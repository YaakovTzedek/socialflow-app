import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import AppShell from '@/components/AppShell';
import LogsScreen from '@/components/LogsScreen';
import { getMessages, localePath, type Locale } from '@/lib/i18n';

export default async function Page({ params }: { params: { locale: Locale } }) {
  const session = await getSession();
  if (!session.userAccessToken) redirect(localePath(params.locale, '/'));
  const m = getMessages(params.locale);
  const userName = session.userName || m.common.user;
  return (
    <AppShell userName={userName} title={m.nav.logs}>
      <Suspense fallback={null}><LogsScreen /></Suspense>
    </AppShell>
  );
}
