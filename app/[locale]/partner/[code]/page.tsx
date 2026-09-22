import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import Link from 'next/link';
import { partnerStats } from '@/lib/affiliates';
import '@/app/landing.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'SocialFlow partner', robots: { index: false, follow: false } };

const BASE = (process.env.NEXT_PUBLIC_BASE_URL || 'https://isocialflow.com').replace(/\/$/, '');

/**
 * A partner's own page. Counts and money only: which businesses signed up
 * through the link is the customers' business, not the partner's.
 */
/** Ranges the partner page offers. 0 is all time and stays the default. */
const RANGES: { days: number; label: string }[] = [
  { days: 7, label: '7 ימים' },
  { days: 30, label: '30 ימים' },
  { days: 90, label: '90 ימים' },
  { days: 0, label: 'הכל' },
];

export default async function PartnerPage({
  params, searchParams,
}: { params: { locale: string; code: string }; searchParams: { days?: string } }) {
  if (!isLocale(params.locale)) notFound();
  const days = RANGES.some((r) => r.days === Number(searchParams.days)) ? Number(searchParams.days) : 0;
  const stats = await partnerStats(params.code, days);
  if (!stats) notFound();
  const link = `${BASE}/he?aff=${stats.code}`;
  const trackedSince = stats.clicksTrackedSince
    ? new Date(stats.clicksTrackedSince).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;

  return (
    <div className="sf sfp" dir="rtl">
      <div className="sf-shell sfp-head">
        <h1 className="sf-display sfp-title">שלום {stats.name}</h1>
        <p className="sfp-lead">הקישור האישי שלך, וכמה הוא הביא עד עכשיו.</p>
        <div className="sf-rule" />
      </div>
      <div className="sf-shell sfp-main">
        <div className="sfad-card">
          <div className="sfad-card-title">הקישור שלך</div>
          <p className="sfp-partner-link" dir="ltr">{link}</p>
          <p className="sfad-empty">
            כל מי שנכנס דרכו ונרשם נספר לך, גם אם הוא נרשם רק כמה שבועות אחר כך.
            אתה מקבל {stats.ratePercent}% מכל תשלום שלו ב-{stats.months} החודשים הראשונים שלו.
          </p>
        </div>

        <nav className="sfp-range" aria-label="טווח תאריכים">
          {RANGES.map((r) => (
            <Link
              key={r.days}
              href={r.days ? `?days=${r.days}` : '?days=0'}
              className={r.days === days ? 'on' : undefined}
              scroll={false}
            >
              {r.label}
            </Link>
          ))}
        </nav>

        <div className="sfad-kpis">
          <div className="sfad-kpi"><strong>{stats.clicks.toLocaleString('he-IL')}</strong><span>כניסות דרך הקישור</span></div>
          <div className="sfad-kpi"><strong>{stats.referrals.toLocaleString('he-IL')}</strong><span>חשבונות שנפתחו</span></div>
          {stats.earnings.length === 0 ? (
            <div className="sfad-kpi"><strong>0</strong><span>עמלות שנצברו</span></div>
          ) : stats.earnings.map((e) => (
            <div key={e.currency} className="sfad-kpi">
              <strong>{e.total.toLocaleString('he-IL')}</strong>
              <span>עמלות ב-{e.currency}</span>
              <small>{e.pending.toLocaleString('he-IL')} ממתין לתשלום</small>
            </div>
          ))}
        </div>

        {days > 0 && (
          <p className="sfp-range-note">
            {trackedSince
              ? `ספירת הכניסות לפי טווח תאריכים זמינה מ-${trackedSince}. לתמונה המלאה מאז ההתחלה, בחרו "הכל".`
              : 'עדיין לא נרשמו כניסות בטווח הזה.'}
          </p>
        )}
      </div>
    </div>
  );
}
