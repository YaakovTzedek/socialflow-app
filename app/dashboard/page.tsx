import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import AppShell from '@/components/AppShell';
import DashboardHome from '@/components/DashboardHome';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session.userAccessToken) redirect('/');
  const userName = session.userName || 'משתמש';
  return (
    <AppShell userName={userName} title="דשבורד">
      <DashboardHome userName={userName} />
    </AppShell>
  );
}
