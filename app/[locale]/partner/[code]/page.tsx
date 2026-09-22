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
/**
 * The windows a partner can ask for. Days are counted in Israel time, not UTC:
 * the server renders in UTC, and without this "today" would start at 03:00
 * local and a partner checking at midnight would see an empty page.
 */
const IL = 'Asia/Jerusalem';

/** Midnight in Israel, `offset` days back, as a real instant. */
function ilMidnight(offset = 0): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: IL, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const [y, m, d] = parts.split('-').map(Number);
  // Israel is UTC+2 or +3; asking Intl for the offset keeps DST honest.
  const noon = new Date(Date.UTC(y, m - 1, d - offset, 12));
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: IL, hour: '2-digit', hour12: false }).format(noon);
  const shift = 12 - Number(local);
  return new Date(Date.UTC(y, m - 1, d - offset, shift));
}

/** One calendar day in Israel, from a YYYY-MM-DD string. */
function ilDay(iso: string): { from: Date; to: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, 0));
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: IL, hour: '2-digit', hour12: false }).format(new Date(Date.UTC(y, m - 1, d, 12)));
  const shift = 12 - Number(local);
  const from = new Date(Date.UTC(y, m - 1, d, shift));
  return { from, to: new Date(from.getTime() + 86400000) };
}

const PRESETS = [
  { key: 'today', label: 'היום' },
  { key: 'yesterday', label: 'אתמול' },
  { key: '7', label: '7 ימים' },
  { key: '30', label: '30 ימים' },
  { key: '90', label: '90 ימים' },
  { key: 'all', label: 'הכל' },
] as const;

export default async function PartnerPage({
  params, searchParams,
}: { params: { locale: string; code: string }; searchParams: { r?: string; date?: string } }) {
  if (!isLocale(params.locale)) notFound();

  const exactDay = searchParams.date ? ilDay(searchParams.date) : null;
  const preset = PRESETS.some((p) => p.key === searchParams.r) ? String(searchParams.r) : (exactDay ? '' : 'all');
  let range: { from?: Date | null; to?: Date | null } = {};
  if (exactDay) range = exactDay;
  else if (preset === 'today') range = { from: ilMidnight(0) };
  else if (preset === 'yesterday') range = { from: ilMidnight(1), to: ilMidnight(0) };
  else if (preset !== 'all') range = { from: new Date(Date.now() - Number(preset) * 86400000) };

  const stats = await partnerStats(params.code, range);
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
          {PRESETS.map((p) => (
            <Link key={p.key} href={`?r=${p.key}`} className={!exactDay && p.key === preset ? 'on' : undefined} scroll={false}>
              {p.label}
            </Link>
          ))}
          <form method="get" className="sfp-range-day">
            <input type="date" name="date" defaultValue={searchParams.date || ''} aria-label="תאריך מסוים" />
            <button type="submit">הצג</button>
          </form>
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

        {stats.windowed && (
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
