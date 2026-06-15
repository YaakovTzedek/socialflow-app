import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import Dashboard from '@/components/Dashboard';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session.userAccessToken) {
    redirect('/');
  }

  return <Dashboard userName={session.userName || 'משתמש'} />;
}
