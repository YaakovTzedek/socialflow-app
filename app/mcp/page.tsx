import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import AppShell from '@/components/AppShell';
import McpScreen from '@/components/McpScreen';

export default async function McpPage() {
  const session = await getSession();
  if (!session.userAccessToken) redirect('/');
  return (
    <AppShell userName={session.userName || 'משתמש'} title="חיבור MCP">
      <McpScreen />
    </AppShell>
  );
}
