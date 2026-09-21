'use client';
import { LoginLink } from './LoginLink';
import { useI18n } from './I18nProvider';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

/** Dashboard on live data: KPIs and the 30-day chart from /api/logs, the accounts card from /api/pages, the active-automations count from /api/automations. */

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
  const { m, t, p, dateTime } = useI18n();
  const D = m.dashboard;
  const [pages, setPages] = useState<Page[]>([]);
  const [autos, setAutos] = useState<Automation[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagesLoading, setPagesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const pagesReq = fetch('/api/pages').then((r) => r.json()).then((pg) => {
          if (pg.error && !pg.pages) throw new Error(pg.error);
          setPages(pg.pages || []);
          setPagesLoading(false);
          if (pg.stale) fetch('/api/pages?refresh=1').then((r) => r.json()).then((f) => { if (f.pages) setPages(f.pages); }).catch(() => {});
        });
        const [a, l] = await Promise.all([fetch('/api/automations').then((r) => r.json()), fetch('/api/logs').then((r) => r.json())]);
        setAutos(a.automations || []);
        setLogs(l.logs || []);
        setLoading(false);
        await pagesReq.catch((e) => { setPagesLoading(false); throw e; });
      } catch (e: any) { setError(e.message); } finally { setLoading(false); }
    })();
  }, []);

  const todayStart = startOfDay(new Date());
  const today = logs.filter((l) => new Date(l.created_at).getTime() >= todayStart);
  const handledToday = today.length;
  const dmsToday = today.filter((l) => l.dm_status === 'sent').length;
  const activeAutos = autos.filter((a) => a.status === 'active').length;
  const yesterdayStart = todayStart - DAY;
  const inYesterday = (l: Log) => { const x = new Date(l.created_at).getTime(); return x >= yesterdayStart && x < todayStart; };
  const handledYesterday = logs.filter(inYesterday).length;
  const dmsYesterday = logs.filter((l) => inYesterday(l) && l.dm_status === 'sent').length;
  const delta = (now: number, prev: number) => (prev === 0 ? (now > 0 ? D.newDelta : '') : `${now >= prev ? '+' : ''}${Math.round(((now - prev) / prev) * 100)}%`);

  const chart = useMemo(() => {
    const days = 30; const first = todayStart - (days - 1) * DAY;
    const a = new Array(days).fill(0), b = new Array(days).fill(0), c = new Array(days).fill(0);
    for (const l of logs) {
      const i = Math.floor((new Date(l.created_at).getTime() - first) / DAY);
      if (i < 0 || i >= days) continue;
      a[i]++; if (l.public_reply_status === 'sent') b[i]++; if (l.dm_status === 'sent') c[i]++;
    }
    const max = Math.max(1, ...a) * 1.15;
    const fmtD = (x: number) => { const d = new Date(x); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`; };
    const axis = [0, 6, 12, 18, 24, 29].map((i) => fmtD(first + i * DAY));
    return { lineA: pathFor(a, 900, 250, max), lineB: pathFor(b, 900, 250, max), lineC: pathFor(c, 900, 250, max), axis, total: a.reduce((s, v) => s + v, 0) };
  }, [logs, todayStart]);

  const autosPerPage = (pageId: string, platform: 'facebook' | 'instagram') => autos.filter((a) => a.page_id === pageId && a.platform === platform).length;
  const recent = logs.slice(0, 5);
  const firstName = userName.split(' ')[0];
  const tagOf = (l: Log) => l.dm_status === 'sent' ? ['sfa-tag-lead', D.tagLead] : l.public_reply_status === 'sent' ? ['sfa-tag-sent', D.tagReply] : l.dm_status === 'failed' || l.public_reply_status === 'failed' ? ['sfa-tag-error', D.tagError] : ['sfa-tag-unsent', D.tagUnsent];

  return (
    <>
      <div className="sfa-head">
        <div>
          <div className="sfa-h">{t(D.hello, { name: firstName })}</div>
          <p>{loading ? D.loadingData : handledToday > 0 ? t(D.todaySummary, { handled: handledToday, dms: dmsToday }) : activeAutos > 0 ? t(D.activeWaiting, { n: activeAutos }) : D.noAutomation}</p>
        </div>
        <Link href={`${p('/automations')}?new=1`} className="sfa-btn sfa-btn-primary sfa-btn-lg">{D.newAutomation}</Link>
      </div>

      {error && <div className="sfa-error">{t(D.loadError, { error })}</div>}

      <div className="sfa-kpis">
        <Link href={p('/logs')} className="sfa-kpi">
          <span className="sfa-kpi-i">◎</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sfa-kpi-v"><strong>{handledToday}</strong><small className={handledToday >= handledYesterday ? 'up' : ''}>{delta(handledToday, handledYesterday)}</small></div>
            <div className="sfa-kpi-l">{D.kpiHandled}</div>
          </div>
          <span className="sfa-kpi-arrow">→</span>
        </Link>
        <Link href={`${p('/logs')}?status=dm_sent`} className="sfa-kpi sfa-kpi-vi">
          <span className="sfa-kpi-i">☺</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sfa-kpi-v"><strong>{dmsToday}</strong><small className={dmsToday >= dmsYesterday ? 'up' : ''}>{delta(dmsToday, dmsYesterday)}</small></div>
            <div className="sfa-kpi-l">{D.kpiDms}</div>
          </div>
          <span className="sfa-kpi-arrow">→</span>
        </Link>
        <Link href={p('/automations')} className="sfa-kpi sfa-kpi-am">
          <span className="sfa-kpi-i">⚡</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sfa-kpi-v"><strong>{activeAutos}</strong><small>{t(D.outOf, { n: autos.length })}</small></div>
            <div className="sfa-kpi-l">{D.kpiActive}</div>
          </div>
          <span className="sfa-kpi-arrow">→</span>
        </Link>
      </div>

      <div className="sfa-dash-grid">
        <div className="sfa-card">
          <div className="sfa-chart-h">
            <div className="sfa-h">{D.chartTitle}</div>
            <div className="sfa-legend">
              <span><i style={{ background: '#2b8bff' }} />{D.legendHandled}</span>
              <span><i style={{ background: '#E1306C' }} />{D.legendReplies}</span>
              <span><i style={{ background: '#833ab4' }} />{D.legendDms}</span>
            </div>
          </div>
          {chart.total === 0 && !loading ? (
            <div className="sfa-empty" style={{ padding: '48px 20px' }}><b>{D.chartEmptyTitle}</b>{D.chartEmptyText}</div>
          ) : (
            <>
              <svg viewBox="0 0 900 260" width="100%" height="240" preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }} aria-label={D.chartAria}>
                <defs><linearGradient id="sfa-afill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E1306C" stopOpacity=".2" /><stop offset="1" stopColor="#E1306C" stopOpacity="0" /></linearGradient></defs>
                <g stroke="rgba(179,154,198,.15)" strokeWidth="1">{[18, 80, 142, 204, 252].map((y) => <line key={y} x1="0" y1={y} x2="900" y2={y} />)}</g>
                <path d={`${chart.lineA} L900 250 L0 250 Z`} fill="url(#sfa-afill)" />
                <path d={chart.lineA} fill="none" stroke="#2b8bff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <path d={chart.lineB} fill="none" stroke="#E1306C" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <path d={chart.lineC} fill="none" stroke="#833ab4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="sfa-axis">{chart.axis.map((a) => <span key={a}>{a}</span>)}</div>
              {logs.length >= 100 && <div className="sfa-sub" style={{ marginTop: 8 }}>{D.last100}</div>}
            </>
          )}
        </div>

        <div className="sfa-stack" style={{ gap: 16 }}>
          <div className="sfa-card">
            <div className="sfa-eyebrow">{D.accountsTitle}</div>
            <div className="sfa-stack">
              {pagesLoading ? <div className="sfa-loading"><span className="sfa-spinner" />{m.common.loading}</div> : pages.length === 0 ? (
                <div className="sfa-sub">{D.noPages}</div>
              ) : pages.map((pg) => (
                <div key={pg.id} className="sfa-stack">
                  <div className="sfa-acct">
                    {pg.picture ? <img src={pg.picture} alt="" /> : <span className="sfa-plat sfa-plat-fb sfa-plat-lg">f</span>}
                    <div><strong>{pg.name}</strong><small>{t(D.pageLine, { n: autosPerPage(pg.id, 'facebook') })}</small></div>
                    <span className="ok" />
                  </div>
                  {pg.instagram && (
                    <div className="sfa-acct">
                      {pg.instagram.picture ? <img src={pg.instagram.picture} alt="" /> : <span className="sfa-plat sfa-plat-ig sfa-plat-lg">◎</span>}
                      <div><strong style={{ direction: 'ltr', textAlign: 'start' }}>@{pg.instagram.username || 'instagram'}</strong><small>{t(D.igLine, { n: autosPerPage(pg.id, 'instagram') })}</small></div>
                      <span className="ok" />
                    </div>
                  )}
                </div>
              ))}
              <LoginLink className="sfa-btn sfa-btn-dashed sfa-btn-sm">{m.common.connectAnother}</LoginLink>
            </div>
          </div>
        </div>
      </div>

      <div className="sfa-card">
        <div className="sfa-sec-h">
          <div className="sfa-h">{D.recentTitle}</div>
          <Link href={p('/logs')} className="sfa-btn sfa-btn-ghost sfa-btn-sm">{D.fullLog}</Link>
        </div>
        {loading ? <div className="sfa-loading"><span className="sfa-spinner" />{m.common.loading}</div> : recent.length === 0 ? (
          <div className="sfa-empty"><b>{D.quietTitle}</b>{D.quietText}</div>
        ) : (
          <div className="sfa-stack" style={{ gap: 9 }}>
            {recent.map((l) => { const [cls, label] = tagOf(l); return (
              <div key={l.id} className="sfa-row-item">
                <span className={`sfa-plat ${l.platform === 'instagram' ? 'sfa-plat-ig' : 'sfa-plat-fb'}`}>{l.platform === 'instagram' ? '◎' : 'f'}</span>
                <span className="sfa-initials">{initialsOf(l.commenter_name)}</span>
                <span className="sfa-user-name">{l.commenter_name || m.common.commenter}</span>
                <span className="sfa-comment">{l.comment_text}</span>
                <span className={`sfa-tag ${cls}`}>{label}</span>
                <span className="sfa-time">{dateTime(l.created_at, { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ); })}
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
