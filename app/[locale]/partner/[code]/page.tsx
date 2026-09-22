import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { partnerStats } from '@/lib/affiliates';
import '@/app/landing.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'SocialFlow partner', robots: { index: false, follow: false } };

const BASE = (process.env.NEXT_PUBLIC_BASE_URL || 'https://isocialflow.com').replace(/\/$/, '');

/**
 * A partner's own page. Counts and money only: which businesses signed up
 * through the link is the customers' business, not the partner's.
 */
export default async function PartnerPage({ params }: { params: { locale: string; code: string } }) {
  if (!isLocale(params.locale)) notFound();
  const stats = await partnerStats(params.code);
  if (!stats) notFound();
  const link = `${BASE}/he?aff=${stats.code}`;

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
      </div>
    </div>
  );
}
