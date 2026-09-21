import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import AppShell from '@/components/AppShell';
import BillingScreen from '@/components/BillingScreen';

export default async function BillingPage() {
  const session = await getSession();
  if (!session.userAccessToken) redirect('/');
  return (
    <AppShell userName={session.userName || 'משתמש'} title="חבילה וחיוב">
      <BillingScreen userName={session.userName || ''} />
    </AppShell>
  );
}
