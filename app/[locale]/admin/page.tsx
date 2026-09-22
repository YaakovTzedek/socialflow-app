import type { Metadata } from 'next';
import { isAdmin } from '@/lib/admin';
import AdminPanel from '@/components/AdminPanel';
import AdminGate from '@/components/AdminGate';
import '@/app/landing.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'SocialFlow admin', robots: { index: false, follow: false } };

/** The owner's private panel. Hebrew only on purpose: an audience of one. */
export default function AdminPage() {
  return isAdmin() ? <AdminPanel /> : <AdminGate />;
}
