import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import AppShell from '@/components/AppShell';
import BillingScreen from '@/components/BillingScreen';
import { getMessages, localePath, type Locale } from '@/lib/i18n';

export default async function Page({ params }: { params: { locale: Locale } }) {
  const session = await getSession();
  if (!session.userAccessToken) redirect(localePath(params.locale, '/'));
  const m = getMessages(params.locale);
  const userName = session.userName || m.common.user;
  return (
    <AppShell userName={userName} title={m.nav.billing}>
      <BillingScreen userName={userName} />
    </AppShell>
  );
}
