import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import AppShell from '@/components/AppShell';
import PostsBrowser from '@/components/PostsBrowser';

export default async function PostsPage() {
  const session = await getSession();
  if (!session.userAccessToken) redirect('/');
  return (
    <AppShell userName={session.userName || 'משתמש'} title="פוסטים ותגובות">
      <PostsBrowser />
    </AppShell>
  );
}
