import type { Metadata } from 'next';
import { isAdminRequest } from '@/lib/admin';
import { getSession } from '@/lib/session';
import { localePath, type Locale } from '@/lib/i18n';
import AdminGate from '@/components/AdminGate';
import AdminTopBar from '@/components/AdminTopBar';
import AdminCustomerDetail from '@/components/AdminCustomerDetail';
import '@/app/landing.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'SocialFlow admin', robots: { index: false, follow: false } };

/** One customer in the owner's admin area. */
export default async function AdminCustomerPage({ params }: { params: { locale: Locale; id: string } }) {
  if (!(await isAdminRequest())) return <AdminGate />;
  const s = await getSession();
  return (
    <div className="sf sfad" dir="rtl">
      <AdminTopBar impersonatingName={s.impersonating?.name ?? null} appHref={localePath(params.locale, '/dashboard')} />
      <p className="sfad-back"><a href="/he/admin">כל הלקוחות</a></p>
      <AdminCustomerDetail id={params.id} />
    </div>
  );
}
