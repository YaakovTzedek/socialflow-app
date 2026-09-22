import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import AppShell from '@/components/AppShell';
import BrainScreen from '@/components/BrainScreen';
import { getMessages, localePath, type Locale } from '@/lib/i18n';

export default async function Page({ params }: { params: { locale: Locale } }) {
  const session = await getSession();
  if (!session.userAccessToken) redirect(localePath(params.locale, '/'));
  const m = getMessages(params.locale);
  return (
    <AppShell userName={session.userName || m.common.user} title={m.nav.brain}>
      <BrainScreen />
    </AppShell>
  );
}
