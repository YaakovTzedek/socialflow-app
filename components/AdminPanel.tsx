'use client';

import { useEffect, useMemo, useState } from 'react';

/**
 * The owner's panel. Reads across every account, so it lives behind its own
 * cookie and never behind the ordinary Facebook session. Hebrew only: the
 * audience is one person.
 */

interface Signup { id: number; phone: string; role: string; tool: string; locale: string; created_at: string }
interface LogRow { id: number; platform: string; commenter_name: string; comment_text: string; matched_keyword: string; public_reply_status: string; dm_status: string; error_message: string | null; created_at: string; automation: string | null }
interface Automation { id: string; name: string; platform: string; status: string; page_name: string | null; keywords: string[]; trigger_count: number; leads: number; owner_id: string }
interface Affiliate { code: string; name: string; phone: string | null; email: string | null; note: string | null; rate_percent: number; months: number; status: string; clicks: number; referrals: number; earned_agorot: string | number; pending_agorot: string | number; created_at: string }
interface Sub { id: number; owner_id: string; plan_id: string; interval: string; status: string; trial_ends_at: string | null; current_period_end: string | null; payer_name: string | null; payer_email: string | null; amount_agorot: number; currency: string; created_at: string }
interface Data {
  signups: Signup[];
  signupStats: { total: number; day: number; week: number };
  signupByLocale: { locale: string; n: number }[];
  delivery: { triggers: number; dms: number; failed: number; replies: number; day: number };
  deliveryErrors: { error_message: string; n: number; last_at: string }[];
  recentLogs: LogRow[];
  automations: Automation[];
  owners: number;
  subscriptions: Sub[];
  overrides: { owner_id: string; plan_id: string; note: string | null; created_at: string }[];
  segments: { segment: string; owners: number; triggers: number; delivery_rate: number; peak_hour: number | null; computed_at: string }[];
  affiliates: Affiliate[];
  now: string;
}

const TABS = [
  { id: 'beta', label: 'רשימת הבטא' },
  { id: 'delivery', label: 'מסירה ותקלות' },
  { id: 'automations', label: 'אוטומציות' },
  { id: 'partners', label: 'שותפים' },
  { id: 'billing', label: 'מנויים' },
] as const;
type TabId = typeof TABS[number]['id'];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function AdminPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('beta');
  const [q, setQ] = useState('');

  async function load() {
    try {
      const res = await fetch('/api/admin/panel');
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setData(d);
    } catch (e: any) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return data.signups;
    return data.signups.filter((s) =>
      [s.phone, s.role, s.tool, s.locale].some((v) => (v || '').toLowerCase().includes(needle)));
  }, [data, q]);

  async function removeSignup(id: number) {
    if (!confirm('למחוק את השורה הזו מהרשימה?')) return;
    await fetch(`/api/admin/panel?signup=${id}`, { method: 'DELETE' });
    load();
  }

  function exportCsv() {
    if (!data) return;
    const head = ['טלפון', 'מה הוא עושה', 'כלי נוכחי', 'שפה', 'תאריך'];
    const rows = filtered.map((s) => [s.phone, s.role, s.tool, s.locale, fmtDate(s.created_at)]);
    const csv = [head, ...rows]
      .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `socialflow-beta-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  async function act(payload: Record<string, unknown>) {
    const res = await fetch('/api/admin/panel', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const d = await res.json();
    if (d.error) alert(d.error); else load();
    return d;
  }

  async function addAffiliate() {
    const name = prompt('שם השותף');
    if (!name) return;
    const phone = prompt('טלפון (אפשר לדלג)') || '';
    const rate = prompt('אחוז עמלה', '50') || '50';
    const months = prompt('לכמה חודשים מהצטרפות הלקוח', '12') || '12';
    const d = await act({ action: 'create_affiliate', name, phone, rate_percent: Number(rate), months: Number(months) });
    if (d.code) alert(`הקישור של ${name}:\n${location.origin}/he?aff=${d.code}`);
  }

  async function grantPlan() {
    const owner_id = prompt('מזהה החשבון (owner_id)');
    if (!owner_id) return;
    const plan_id = prompt('מסלול: free, creator, pro, agency', 'pro') || 'pro';
    const months = prompt('לכמה חודשים (0 = לתמיד)', '12') || '12';
    const note = prompt('הערה', 'שנה חינם תמורת סרטון') || '';
    await act({ action: 'grant_plan', owner_id, plan_id, months: Number(months), note });
  }

  async function signOut() {
    await fetch('/api/admin/login', { method: 'DELETE' });
    location.reload();
  }

  if (error) return <div className="sf sfad" dir="rtl"><div className="sf-error">{error}</div></div>;
  if (!data) return <div className="sf sfad" dir="rtl"><div className="sfad-loading">טוען</div></div>;

  const d = data;
  const rate = d.delivery.triggers ? Math.round((d.delivery.dms / d.delivery.triggers) * 100) : 0;

  return (
    <div className="sf sfad" dir="rtl">
      <div className="sfad-bar">
        <div className="sfad-brand" dir="ltr">Social<span className="sf-grad-text">Flow</span></div>
        <span className="sfad-badge">אזור ניהול</span>
        <button type="button" className="sfad-link" onClick={load}>רענון</button>
        <button type="button" className="sfad-link" onClick={signOut}>יציאה</button>
      </div>

      <div className="sfad-kpis">
        <Kpi value={d.signupStats.total} label="נרשמו לבטא" sub={`${d.signupStats.day} ביממה, ${d.signupStats.week} בשבוע`} />
        <Kpi value={d.owners} label="חשבונות מחוברים" />
        <Kpi value={d.delivery.dms} label="הודעות פרטיות נשלחו" sub={`${rate}% מהתגובות התואמות`} />
        <Kpi value={d.delivery.failed} label="כשלים פתוחים" tone={d.delivery.failed > 0 ? 'warn' : 'good'} />
      </div>

      <div className="sfad-tabs">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={t.id === tab ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === 'beta' && (
        <section className="sfad-card">
          <div className="sfad-card-head">
            <div className="sfad-card-title">רשימת הבטא</div>
            <input className="sfad-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש בטלפון, בעיסוק או בכלי" />
            <button type="button" className="sf-btn sf-btn-ghost sf-btn-sm" onClick={exportCsv} disabled={!filtered.length}>ייצוא CSV</button>
          </div>
          {d.signupByLocale.length > 0 && (
            <div className="sfad-chips">
              {d.signupByLocale.map((x) => <i key={x.locale}>{x.locale}: {x.n}</i>)}
            </div>
          )}
          {filtered.length === 0 ? (
            <p className="sfad-empty">{d.signups.length ? 'אין תוצאות לחיפוש הזה.' : 'עדיין אף אחד לא נרשם.'}</p>
          ) : (
            <div className="sfad-scroll">
              <table className="sfad-table">
                <thead><tr><th>טלפון</th><th>מה הוא עושה</th><th>כלי נוכחי</th><th>שפה</th><th>מתי</th><th /></tr></thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id}>
                      <td><a href={`tel:${s.phone}`} dir="ltr">{s.phone}</a></td>
                      <td>{s.role}</td>
                      <td>{s.tool}</td>
                      <td><span className="sfad-tag">{s.locale}</span></td>
                      <td className="sfad-dim">{fmtDate(s.created_at)}</td>
                      <td><button type="button" className="sfad-x" onClick={() => removeSignup(s.id)} aria-label="מחיקה">×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'delivery' && (
        <>
          <section className="sfad-card">
            <div className="sfad-card-title">בריאות המסירה</div>
            <div className="sfad-mini">
              <span>תגובות שטופלו: <b>{d.delivery.triggers}</b></span>
              <span>תגובות ציבוריות: <b>{d.delivery.replies}</b></span>
              <span>הודעות פרטיות: <b>{d.delivery.dms}</b></span>
              <span>כשלים: <b>{d.delivery.failed}</b></span>
              <span>ביממה האחרונה: <b>{d.delivery.day}</b></span>
            </div>
            {d.deliveryErrors.length > 0 && (
              <div className="sfad-scroll" style={{ marginBlockStart: 14 }}>
                <table className="sfad-table">
                  <thead><tr><th>שגיאה</th><th>כמה</th><th>אחרונה</th></tr></thead>
                  <tbody>
                    {d.deliveryErrors.map((e) => (
                      <tr key={e.error_message}><td dir="ltr">{e.error_message}</td><td>{e.n}</td><td className="sfad-dim">{fmtDate(e.last_at)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="sfad-card">
            <div className="sfad-card-title">הפעלות אחרונות</div>
            <div className="sfad-scroll">
              <table className="sfad-table">
                <thead><tr><th>מתי</th><th>אוטומציה</th><th>מגיב</th><th>מילה</th><th>ציבורית</th><th>פרטית</th></tr></thead>
                <tbody>
                  {d.recentLogs.map((l) => (
                    <tr key={l.id}>
                      <td className="sfad-dim">{fmtDate(l.created_at)}</td>
                      <td>{l.automation || '—'}</td>
                      <td dir="ltr">{l.commenter_name}</td>
                      <td>{l.matched_keyword || '—'}</td>
                      <td><Status v={l.public_reply_status} /></td>
                      <td><Status v={l.dm_status} title={l.error_message || undefined} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {tab === 'automations' && (
        <section className="sfad-card">
          <div className="sfad-card-title">אוטומציות לפי לידים</div>
          <div className="sfad-scroll">
            <table className="sfad-table">
              <thead><tr><th>שם</th><th>עמוד</th><th>פלטפורמה</th><th>מילים</th><th>סטטוס</th><th>הפעלות</th><th>לידים</th></tr></thead>
              <tbody>
                {d.automations.map((a) => (
                  <tr key={a.id}>
                    <td>{a.name}</td>
                    <td className="sfad-dim">{a.page_name || '—'}</td>
                    <td>{a.platform}</td>
                    <td>{a.keywords?.length ? a.keywords.join(', ') : 'כל תגובה'}</td>
                    <td><Status v={a.status} /></td>
                    <td>{a.trigger_count}</td>
                    <td><b>{a.leads}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'partners' && (
        <section className="sfad-card">
          <div className="sfad-card-head">
            <div className="sfad-card-title">שותפים</div>
            <button type="button" className="sf-btn sf-btn-primary sf-btn-sm" onClick={addAffiliate}>שותף חדש</button>
            <button type="button" className="sf-btn sf-btn-ghost sf-btn-sm" onClick={grantPlan}>הענקת מסלול</button>
          </div>
          {d.affiliates.length === 0 ? (
            <p className="sfad-empty">עדיין אין שותפים. כפתור "שותף חדש" מייצר קישור אישי.</p>
          ) : (
            <div className="sfad-scroll">
              <table className="sfad-table">
                <thead><tr><th>שם</th><th>קישור</th><th>תנאים</th><th>כניסות</th><th>נרשמו</th><th>נצבר</th><th>לתשלום</th><th>סטטוס</th><th /></tr></thead>
                <tbody>
                  {d.affiliates.map((a) => (
                    <tr key={a.code}>
                      <td>{a.name}<br /><span className="sfad-dim" dir="ltr">{a.phone || ''}</span></td>
                      <td>
                        <button type="button" className="sfad-copy" onClick={() => navigator.clipboard.writeText(`${location.origin}/he?aff=${a.code}`)}>העתקה</button>
                        <a href={`/he/partner/${a.code}`} target="_blank" rel="noreferrer">הדף שלו</a>
                      </td>
                      <td className="sfad-dim">{a.rate_percent}% · {a.months} חודשים</td>
                      <td>{a.clicks}</td>
                      <td><b>{a.referrals}</b></td>
                      <td dir="ltr">{(Number(a.earned_agorot) / 100).toLocaleString('he-IL')}</td>
                      <td dir="ltr"><b>{(Number(a.pending_agorot) / 100).toLocaleString('he-IL')}</b></td>
                      <td><Status v={a.status} /></td>
                      <td>
                        {Number(a.pending_agorot) > 0 && (
                          <button type="button" className="sfad-copy" onClick={() => confirm('לסמן את כל העמלות הפתוחות כשולמו?') && act({ action: 'pay_affiliate', code: a.code })}>שולם</button>
                        )}
                        <button type="button" className="sfad-copy" onClick={() => act({ action: 'set_affiliate_status', code: a.code, status: a.status === 'active' ? 'paused' : 'active' })}>
                          {a.status === 'active' ? 'השהיה' : 'הפעלה'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'billing' && (
        <>
          <section className="sfad-card">
            <div className="sfad-card-title">מנויים</div>
            {d.subscriptions.length === 0 ? <p className="sfad-empty">אין עדיין מנויים.</p> : (
              <div className="sfad-scroll">
                <table className="sfad-table">
                  <thead><tr><th>מסלול</th><th>סטטוס</th><th>משלם</th><th>סכום</th><th>סוף תקופה</th><th>נוצר</th></tr></thead>
                  <tbody>
                    {d.subscriptions.map((s) => (
                      <tr key={s.id}>
                        <td>{s.plan_id} · {s.interval === 'year' ? 'שנתי' : 'חודשי'}</td>
                        <td><Status v={s.status} /></td>
                        <td>{s.payer_name || '—'}<br /><span className="sfad-dim" dir="ltr">{s.payer_email}</span></td>
                        <td dir="ltr">{(s.amount_agorot / 100).toLocaleString('he-IL')} {s.currency}</td>
                        <td className="sfad-dim">{s.current_period_end ? fmtDate(s.current_period_end) : '—'}</td>
                        <td className="sfad-dim">{fmtDate(s.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="sfad-card">
            <div className="sfad-card-title">מסלולים שהוגדרו ידנית</div>
            {d.overrides.length === 0 ? <p className="sfad-empty">אין.</p> : (
              <div className="sfad-scroll">
                <table className="sfad-table">
                  <thead><tr><th>חשבון</th><th>מסלול</th><th>הערה</th><th>מתי</th></tr></thead>
                  <tbody>
                    {d.overrides.map((o) => (
                      <tr key={o.owner_id}><td dir="ltr">{o.owner_id}</td><td>{o.plan_id}</td><td>{o.note || '—'}</td><td className="sfad-dim">{fmtDate(o.created_at)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="sfad-card">
            <div className="sfad-card-title">ממוצעים לפי תחום</div>
            {d.segments.length === 0 ? (
              <p className="sfad-empty">עדיין אין מספיק חשבונות בשום תחום כדי לחשב ממוצע.</p>
            ) : (
              <div className="sfad-scroll">
                <table className="sfad-table">
                  <thead><tr><th>תחום</th><th>חשבונות</th><th>תגובות</th><th>מתגובה לליד</th><th>שעת שיא</th></tr></thead>
                  <tbody>
                    {d.segments.map((s) => (
                      <tr key={s.segment}><td>{s.segment}</td><td>{s.owners}</td><td>{s.triggers}</td><td>{s.delivery_rate}%</td><td>{s.peak_hour !== null ? `${String(s.peak_hour).padStart(2, '0')}:00` : '—'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({ value, label, sub, tone }: { value: number; label: string; sub?: string; tone?: 'good' | 'warn' }) {
  return (
    <div className={`sfad-kpi${tone ? ` ${tone}` : ''}`}>
      <strong>{value.toLocaleString('he-IL')}</strong>
      <span>{label}</span>
      {sub && <small>{sub}</small>}
    </div>
  );
}

function Status({ v, title }: { v: string; title?: string }) {
  const tone = v === 'sent' || v === 'active' ? 'good' : v === 'failed' || v === 'past_due' ? 'bad' : 'muted';
  const label: Record<string, string> = {
    sent: 'נשלח', failed: 'נכשל', skipped: 'דילוג', skipped_duplicate: 'כבר נשלח',
    active: 'פעיל', paused: 'מושהה', trialing: 'ניסיון', canceled: 'בוטל', past_due: 'חוב',
  };
  return <span className={`sfad-status ${tone}`} title={title}>{label[v] || v}</span>;
}
