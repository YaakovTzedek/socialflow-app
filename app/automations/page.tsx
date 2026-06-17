import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import Automations from '@/components/Automations';

export default async function AutomationsPage() {
  const session = await getSession();
  if (!session.userAccessToken) {
    redirect('/');
  }
  return <Automations userName={session.userName || 'משתמש'} />;
}
