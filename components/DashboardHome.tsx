'use client';
import { LoginLink } from './LoginLink';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

/** Dashboard (screen 1 of the Claude Design "SocialFlow App"), on live data:
 *  KPIs and the 30-day chart come from /api/logs, the accounts card from
 *  /api/pages, the active-automations count from /api/automations. */

interface Page { id: string; name: string; picture?: string; fan_count?: number; instagram?: { id: string; username?: string; picture?: string; followers?: number } | null }
interface Automation { id: string; status: string; page_id: string; platform: string }
interface Log { id: number; automation_name?: string; platform?: string; commenter_name?: string; comment_text?: string; matched_keyword?: string; public_reply_status?: string; dm_status?: string; created_at: string }

const DAY = 86400000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

function pathFor(vals: number[], w: number, h: number, max: number) {
  const step = vals.length > 1 ? w / (vals.length - 1) : w;
  return vals.map((v, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)} ${(h - (v / max) * h).toFixed(1)}`).join(' ');
}

export default function DashboardHome({ userName }: { userName: string }) {
  const [pages, setPages] = useState<Page[]>([]);
  const [autos, setAutos] = useState<Automation[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [p, a, l] = await Promise.all([
          fetch('/api/pages').then((r) => r.json()),
          fetch('/api/automations').then((r) => r.json()),
          fetch('/api/logs').then((r) => r.json()),
        ]);
        if (p.error && !p.pages) throw new Error(p.error);
        setPages(p.pages || []);
        setAutos(a.automations || []);
        setLogs(l.logs || []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const todayStart = startOfDay(new Date());
  const today = logs.filter((l) => new Date(l.created_at).getTime() >= todayStart);
  const handledToday = today.length;
  const dmsToday = today.filter((l) => l.dm_status === 'sent').length;
  const activeAutos = autos.filter((a) => a.status === 'active').length;
  const yesterdayStart = todayStart - DAY;
  const handledYesterday = logs.filter((l) => { const t = new Date(l.created_at).getTime(); return t >= yesterdayStart && t < todayStart; }).length;
  const dmsYesterday = logs.filter((l) => { const t = new Date(l.created_at).getTime(); return t >= yesterdayStart && t < todayStart && l.dm_status === 'sent'; }).length;
  const delta = (now: number, prev: number) => (prev === 0 ? (now > 0 ? 'חדש' : '') : `${now >= prev ? '+' : ''}${Math.round(((now - prev) / prev) * 100)}%`);

  // 30-day series: handled comments, public replies sent, DMs sent
  const chart = useMemo(() => {
    const days = 30;
    const first = todayStart - (days - 1) * DAY;
    const a = new Array(days).fill(0), b = new Array(days).fill(0), c = new Array(days).fill(0);
    for (const l of logs) {
      const i = Math.floor((new Date(l.created_at).getTime() - first) / DAY);
      if (i < 0 || i >= days) continue;
      a[i]++;
      if (l.public_reply_status === 'sent') b[i]++;
      if (l.dm_status === 'sent') c[i]++;
    }
    const max = Math.max(1, ...a) * 1.15;
    const fmt = (t: number) => { const d = new Date(t); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`; };
    const axis = [0, 6, 12, 18, 24, 29].map((i) => fmt(first + i * DAY));
    return { lineB: pathFor(b, 900, 250, max), lineC: pathFor(c, 900, 250, max), axis, total: a.reduce((s, v) => s + v, 0), max };
  }, [logs, todayStart]);
  const lineA = pathFor(useMemo(() => {
    const days = 30, first = todayStart - (days - 1) * DAY, a = new Array(days).fill(0);
    for (const l of logs) { const i = Math.floor((new Date(l.created_at).getTime() - first) / DAY); if (i >= 0 && i < days) a[i]++; }
    return a;
  }, [logs, todayStart]), 900, 250, chart.max);

  const autosPerPage = (pageId: string, platform: 'facebook' | 'instagram') => autos.filter((a) => a.page_id === pageId && a.platform === platform).length;
  const recent = logs.slice(0, 5);
  const firstName = userName.split(' ')[0];

  return (
    <>
      <div className="sfa-head">
        <div>
          <div className="sfa-h">שלום {firstName} 👋</div>
          <p>{loading ? 'טוען נתונים…' : handledToday > 0 ? `היום טופלו ${handledToday} תגובות ונשלחו ${dmsToday} הודעות פרטיות.` : activeAutos > 0 ? `${activeAutos} אוטומציות פעילות ומחכות לתגובה הבאה.` : 'עדיין אין אוטומציה פעילה. זה הזמן ליצור את הראשונה.'}</p>
        </div>
        <Link href="/automations?new=1" className="sfa-btn sfa-btn-primary sfa-btn-lg">+ אוטומציה חדשה</Link>
      </div>

      {error && <div className="sfa-error">שגיאה בטעינה: {error}</div>}

      <div className="sfa-kpis">
        <Link href="/logs" className="sfa-kpi">
          <span className="sfa-kpi-i">◎</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sfa-kpi-v"><strong>{handledToday}</strong><small className={handledToday >= handledYesterday ? 'up' : ''}>{delta(handledToday, handledYesterday)}</small></div>
            <div className="sfa-kpi-l">תגובות שטופלו היום</div>
          </div>
          <span className="sfa-kpi-arrow">←</span>
        </Link>
        <Link href="/logs?status=dm_sent" className="sfa-kpi sfa-kpi-vi">
          <span className="sfa-kpi-i">☺</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sfa-kpi-v"><strong>{dmsToday}</strong><small className={dmsToday >= dmsYesterday ? 'up' : ''}>{delta(dmsToday, dmsYesterday)}</small></div>
            <div className="sfa-kpi-l">לידים שקיבלו הודעה פרטית היום</div>
          </div>
          <span className="sfa-kpi-arrow">←</span>
        </Link>
        <Link href="/automations" className="sfa-kpi sfa-kpi-am">
          <span className="sfa-kpi-i">⚡</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sfa-kpi-v"><strong>{activeAutos}</strong><small>מתוך {autos.length}</small></div>
            <div className="sfa-kpi-l">אוטומציות פעילות</div>
          </div>
          <span className="sfa-kpi-arrow">←</span>
        </Link>
      </div>

      <div className="sfa-dash-grid">
        <div className="sfa-card">
          <div className="sfa-chart-h">
            <div className="sfa-h">30 הימים האחרונים</div>
            <div className="sfa-legend">
              <span><i style={{ background: '#2b8bff' }} />תגובות שטופלו</span>
              <span><i style={{ background: '#3ff2ff' }} />תגובות ציבוריות</span>
              <span><i style={{ background: '#7c5cff' }} />הודעות פרטיות</span>
            </div>
          </div>
          {chart.total === 0 && !loading ? (
            <div className="sfa-empty" style={{ padding: '48px 20px' }}><b>עדיין אין פעילות</b>הגרף יתמלא ברגע שהאוטומציה הראשונה תטפל בתגובה.</div>
          ) : (
            <>
              <svg viewBox="0 0 900 260" width="100%" height="240" preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }} aria-label="גרף פעילות 30 יום">
                <defs><linearGradient id="sfa-afill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3ff2ff" stopOpacity=".2" /><stop offset="1" stopColor="#3ff2ff" stopOpacity="0" /></linearGradient></defs>
                <g stroke="rgba(143,163,200,.15)" strokeWidth="1">
                  {[18, 80, 142, 204, 252].map((y) => <line key={y} x1="0" y1={y} x2="900" y2={y} />)}
                </g>
                <path d={`${lineA} L900 250 L0 250 Z`} fill="url(#sfa-afill)" />
                <path d={lineA} fill="none" stroke="#2b8bff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <path d={chart.lineB} fill="none" stroke="#3ff2ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <path d={chart.lineC} fill="none" stroke="#7c5cff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="sfa-axis">{chart.axis.map((a) => <span key={a}>{a}</span>)}</div>
              {logs.length >= 100 && <div className="sfa-sub" style={{ marginTop: 8 }}>מוצגות 100 הפעולות האחרונות.</div>}
            </>
          )}
        </div>

        <div className="sfa-stack" style={{ gap: 16 }}>
          <div className="sfa-card">
            <div className="sfa-eyebrow">חשבונות מחוברים</div>
            <div className="sfa-stack">
              {loading ? <div className="sfa-loading"><span className="sfa-spinner" />טוען…</div> : pages.length === 0 ? (
                <div className="sfa-sub">לא נמצאו דפים. ודא שיש לך הרשאות ניהול לפחות לדף פייסבוק אחד.</div>
              ) : pages.map((p) => (
                <div key={p.id} className="sfa-stack">
                  <div className="sfa-acct">
                    {p.picture ? <img src={p.picture} alt="" /> : <span className="sfa-plat sfa-plat-fb sfa-plat-lg">f</span>}
                    <div><strong>{p.name}</strong><small>דף פייסבוק · {autosPerPage(p.id, 'facebook')} אוטומציות</small></div>
                    <span className="ok" />
                  </div>
                  {p.instagram && (
                    <div className="sfa-acct">
                      {p.instagram.picture ? <img src={p.instagram.picture} alt="" /> : <span className="sfa-plat sfa-plat-ig sfa-plat-lg">◎</span>}
                      <div><strong style={{ direction: 'ltr', textAlign: 'right' }}>@{p.instagram.username || 'instagram'}</strong><small>אינסטגרם עסקי · {autosPerPage(p.id, 'instagram')} אוטומציות</small></div>
                      <span className="ok" />
                    </div>
                  )}
                </div>
              ))}
              <LoginLink className="sfa-btn sfa-btn-dashed sfa-btn-sm">+ חבר חשבון נוסף</LoginLink>
            </div>
          </div>
        </div>
      </div>

      <div className="sfa-card">
        <div className="sfa-sec-h">
          <div className="sfa-h">פעילות אחרונה</div>
          <Link href="/logs" className="sfa-btn sfa-btn-ghost sfa-btn-sm">ליומן המלא ←</Link>
        </div>
        {loading ? <div className="sfa-loading"><span className="sfa-spinner" />טוען…</div> : recent.length === 0 ? (
          <div className="sfa-empty"><b>שקט בינתיים</b>כשמישהו יגיב ויפעיל אוטומציה, זה יופיע כאן.</div>
        ) : (
          <div className="sfa-stack" style={{ gap: 9 }}>
            {recent.map((l) => (
              <div key={l.id} className="sfa-row-item">
                <span className={`sfa-plat ${l.platform === 'instagram' ? 'sfa-plat-ig' : 'sfa-plat-fb'}`}>{l.platform === 'instagram' ? '◎' : 'f'}</span>
                <span className="sfa-initials">{initialsOf(l.commenter_name)}</span>
                <span className="sfa-user-name">{l.commenter_name || 'מגיב'}</span>
                <span className="sfa-comment">{l.comment_text}</span>
                <span className={`sfa-tag ${l.dm_status === 'sent' ? 'sfa-tag-lead' : l.public_reply_status === 'sent' ? 'sfa-tag-sent' : l.dm_status === 'failed' || l.public_reply_status === 'failed' ? 'sfa-tag-error' : 'sfa-tag-unsent'}`}>
                  {l.dm_status === 'sent' ? 'ליד חדש' : l.public_reply_status === 'sent' ? 'נשלחה תגובה' : l.dm_status === 'failed' || l.public_reply_status === 'failed' ? 'שגיאה' : 'לא נשלחה'}
                </span>
                <span className="sfa-time">{new Date(l.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export function initialsOf(name?: string) {
  const parts = (name || '').replace(/^@/, '').trim().split(/[\s._]+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}
