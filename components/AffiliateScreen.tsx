'use client';

import { useEffect, useState } from 'react';
import { useI18n } from './I18nProvider';
import { useReadOnly } from './ReadOnlyContext';

/**
 * /affiliate (3.10.2026): the partner programme inside the app. A partner used
 * to get only a bare link from Yaakov and a public stats page, so inside
 * SocialFlow there was no trace of it. Here: join (self-serve, standard terms),
 * the personal link with copy and WhatsApp share, and the numbers.
 */

interface View {
  joined: boolean; status?: string; link?: string; statsUrl?: string; code?: string;
  ratePercent?: number; months?: number; clicks?: number; referrals?: number;
  earnings?: { currency: string; total: number; pending: number }[];
}

export default function AffiliateScreen() {
  const { m, t, num } = useI18n();
  const ro = useReadOnly();
  const A = m.affiliate;
  const [v, setV] = useState<View | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/affiliate').then((r) => r.json()).then((d) => { if (d.error) throw new Error(d.error); setV(d); }).catch((e) => setErr(e.message));
  }, []);

  const join = async () => {
    setBusy(true);
    try { const d = await fetch('/api/affiliate', { method: 'POST' }).then((r) => r.json()); if (d.error) throw new Error(d.error); setV(d); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(v?.link || ''); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the link is visible to copy by hand */ }
  };

  if (err) return <div className="sfa-error">{err}</div>;
  if (!v) return <div className="sfa-empty">{m.common.loading}</div>;

  const money = (cur: string, n: number) => (cur === 'ILS' ? '₪' : '$') + num(Math.round(n * 100) / 100);
  const terms = t(A.terms, { rate: v.ratePercent ?? 50, months: v.months ?? 12 });

  if (!v.joined) {
    return (
      <div className="sfa-card sfa-aff">
        <div className="sfa-h sfa-aff-title">{A.joinTitle}</div>
        <p>{t(A.terms, { rate: 50, months: 12 })}</p>
        <ul className="sfa-aff-steps"><li>{A.step1}</li><li>{A.step2}</li><li>{A.step3}</li></ul>
        {!ro && <button type="button" className="sfa-btn sfa-btn-primary" onClick={join} disabled={busy}>{A.join}</button>}
      </div>
    );
  }

  const share = `https://wa.me/?text=${encodeURIComponent(t(A.shareText, { link: v.link || '' }))}`;
  return (
    <div className="sfa-aff-wrap">
      <div className="sfa-card sfa-aff">
        <div className="sfa-h sfa-aff-title">{A.yourLink}</div>
        <p>{terms}</p>
        <div className="sfa-aff-link">
          <input readOnly dir="ltr" value={v.link} onFocus={(e) => e.currentTarget.select()} aria-label={A.yourLink} />
          <button type="button" className="sfa-btn sfa-btn-primary" onClick={copy}>{copied ? A.copied : A.copy}</button>
          <a className="sfa-btn" href={share} target="_blank" rel="noopener">{A.shareWhatsapp}</a>
        </div>
        {v.status !== 'active' && <div className="sfa-warn">{A.inactive}</div>}
      </div>
      <div className="sfa-kpis">
        <div className="sfa-kpi"><div style={{ flex: 1, minWidth: 0 }}><div className="sfa-kpi-v"><strong>{num(v.clicks ?? 0)}</strong></div><div className="sfa-kpi-l">{A.clicks}</div></div></div>
        <div className="sfa-kpi sfa-kpi-vi"><div style={{ flex: 1, minWidth: 0 }}><div className="sfa-kpi-v"><strong>{num(v.referrals ?? 0)}</strong></div><div className="sfa-kpi-l">{A.signups}</div></div></div>
        <div className="sfa-kpi sfa-kpi-am"><div style={{ flex: 1, minWidth: 0 }}>
          <div className="sfa-kpi-v"><strong>{v.earnings?.length ? v.earnings.map((e) => money(e.currency, e.total)).join(' + ') : money('ILS', 0)}</strong></div>
          <div className="sfa-kpi-l">{A.earned}{v.earnings?.some((e) => e.pending > 0) ? ` · ${A.pending} ${v.earnings.map((e) => money(e.currency, e.pending)).join(' + ')}` : ''}</div>
        </div></div>
      </div>
      <div className="sfa-card sfa-aff">
        <div className="sfa-h sfa-aff-title">{A.howTitle}</div>
        <ul className="sfa-aff-steps"><li>{A.step1}</li><li>{A.step2}</li><li>{A.step3}</li></ul>
        <p className="sfa-aff-note">{A.payoutNote}</p>
        {v.statsUrl && <a href={v.statsUrl} target="_blank" rel="noopener">{A.fullStats}</a>}
      </div>
    </div>
  );
}
