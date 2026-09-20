import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import AppShell from '@/components/AppShell';
import LogsScreen from '@/components/LogsScreen';

export default async function LogsPage() {
  const session = await getSession();
  if (!session.userAccessToken) redirect('/');
  return (
    <AppShell userName={session.userName || 'משתמש'} title="יומן פעילות">
      <Suspense fallback={null}>
        <LogsScreen />
      </Suspense>
    </AppShell>
  );
}
