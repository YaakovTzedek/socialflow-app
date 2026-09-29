import type { Metadata } from 'next';
import { isAdminRequest } from '@/lib/admin';
import { getSession } from '@/lib/session';
import { localePath, type Locale } from '@/lib/i18n';
import AdminPanel from '@/components/AdminPanel';
import AdminGate from '@/components/AdminGate';
import '@/app/landing.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'SocialFlow admin', robots: { index: false, follow: false } };

/**
 * The owner's private panel. Hebrew only on purpose: an audience of one.
 * The owner's own Facebook session opens it directly; anyone else needs the
 * access code (AdminGate), as before.
 */
export default async function AdminPage({ params }: { params: { locale: Locale } }) {
  if (!(await isAdminRequest())) return <AdminGate />;
  const s = await getSession();
  return <AdminPanel impersonatingName={s.impersonating?.name ?? null} appHref={localePath(params.locale, '/dashboard')} />;
}
