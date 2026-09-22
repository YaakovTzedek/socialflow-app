'use client';

import { useEffect, useState } from 'react';
import { useI18n } from './I18nProvider';

/**
 * Brain: what this account has learned from its own history, plus what the
 * whole system has learned from accounts in the same segment.
 *
 * Nothing here is modelled. Every figure is counted from the account's own
 * trigger log, and the segment benchmark is an average over at least five
 * accounts, so no other customer is ever identifiable from this screen.
 */

interface Row { id: string; label: string; sub?: string | null; permalink?: string | null; triggers: number; leads: number; rate: number }
interface Insight { key: string; vars: Record<string, string | number>; tone: 'good' | 'warn' | 'info' }
interface Rec { key: string; weight: number; tone: 'do' | 'try' | 'fix'; vars: Record<string, string | number>; permalink?: string | null }
interface History { posts: number; instagram: number; facebook: number; comments: number; likes: number; fetched_at: string | null; oldest: string | null; newest: string | null }
interface Benchmark { segment: string; owners: number; deliveryRate: number; linkRate: number | null; noLinkRate: number | null; peakHour: number | null; topKeywords: string[]; computedAt: string }
interface Data {
  days: number;
  totals: { triggers: number; leads: number; replies: number; failed: number; deliveryRate: number };
  automations: Row[]; posts: Row[]; keywords: Row[];
  byHour: { hour: number; triggers: number }[];
  daily: { day: string; triggers: number; leads: number }[];
  insights: Insight[];
  hasData: boolean;
  segment: string | null;
  benchmark: Benchmark | null;
  recommendations: Rec[];
  history: History | null;
}

const PERIODS = [7, 30, 90];

export default function BrainScreen() {
  const { m, t, num } = useI18n();
  const B = m.brain;
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);

  useEffect(() => {
    setLoading(true);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    fetch(`/api/brain?days=${days}&tz=${encodeURIComponent(tz)}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setData(d); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [days]);

  async function pullHistory() {
    setPulling(true);
    try {
      const res = await fetch('/api/brain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ingest' }) });
      const d = await res.json();
      if (d.ok) {
        // The recommendations are computed from what was just read, so reload.
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        const fresh = await fetch(`/api/brain?days=${days}&tz=${encodeURIComponent(tz)}`).then((r) => r.json());
        if (!fresh.error) setData(fresh);
      }
    } finally { setPulling(false); }
  }

  async function pickSegment(segment: string) {
    const res = await fetch('/api/brain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ segment }) });
    const d = await res.json();
    if (d.ok) setData((prev) => (prev ? { ...prev, segment: d.segment, benchmark: d.benchmark } : prev));
  }

  if (loading && !data) return <div className="sfa-card">{m.common.loading}</div>;
  if (error) return <div className="sfa-error">{error}</div>;
  if (!data) return null;

  const hourMax = Math.max(1, ...data.byHour.map((h) => h.triggers));
  const insightText = (i: Insight) => t((B.insights as Record<string, string>)[i.key] || '', i.vars);

  return (
    <div className="sfb">
      <div className="sfb-top">
        <div>
          <div className="sfa-h">{B.title}</div>
          <div className="sfa-sub">{B.subtitle}</div>
        </div>
        <div className="sfb-periods">
          {PERIODS.map((d) => (
            <button key={d} type="button" className={d === days ? 'on' : ''} onClick={() => setDays(d)}>
              {t(B.lastDays, { days: d })}
            </button>
          ))}
        </div>
      </div>

      {!data.hasData && (
        <div className="sfa-card sfb-empty">
          <div className="sfb-empty-title">{B.emptyTitle}</div>
          <div className="sfa-sub">{B.emptyText}</div>
        </div>
      )}

      <div className="sfb-kpis">
        <div className="sfb-kpi"><strong>{num(data.totals.triggers)}</strong><span>{B.kpiTriggers}</span></div>
        <div className="sfb-kpi"><strong>{num(data.totals.leads)}</strong><span>{B.kpiLeads}</span></div>
        <div className="sfb-kpi"><strong>{data.totals.deliveryRate}%</strong><span>{B.kpiRate}</span></div>
        <div className="sfb-kpi"><strong>{num(data.totals.replies)}</strong><span>{B.kpiReplies}</span></div>
      </div>

      {/* What to do next, before what already happened. */}
      <div className="sfa-card">
        <div className="sfb-card-title">{B.recsTitle}</div>
        <div className="sfa-sub">{B.recsSub}</div>
        {data.recommendations.length === 0 ? (
          <p className="sfb-empty-line">{B.recsEmpty}</p>
        ) : (
          <div className="sfb-recs">
            {data.recommendations.map((r) => (
              <div key={r.key} className={`sfb-rec ${r.tone}`}>
                <span className="sfb-rec-tag">{r.tone === 'fix' ? '!' : r.tone === 'do' ? '\u2192' : '~'}</span>
                <div>
                  <div>{t((B.recs as Record<string, string>)[r.key] || '', r.vars)}</div>
                  {r.permalink && <a href={r.permalink} target="_blank" rel="noopener noreferrer" className="sfb-rec-link">{B.topPosts}</a>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="sfb-history">
          {data.history && data.history.posts > 0 ? (
            <>
              <div className="sfb-history-line">
                {t(B.historyText, {
                  posts: num(data.history.posts), comments: num(data.history.comments), likes: num(data.history.likes),
                  oldest: data.history.oldest ? data.history.oldest.slice(0, 10) : '', newest: data.history.newest ? data.history.newest.slice(0, 10) : '',
                })}
              </div>
              {data.history.fetched_at && <div className="sfb-history-sub">{t(B.historyUpdated, { date: data.history.fetched_at.slice(0, 16).replace('T', ' ') })}</div>}
            </>
          ) : (
            <div className="sfb-history-line">{B.historyNone}</div>
          )}
          <button type="button" className="sf-btn sf-btn-ghost sf-btn-sm" onClick={pullHistory} disabled={pulling}>
            {pulling ? B.historyPulling : B.historyPull}
          </button>
        </div>
      </div>

      {data.insights.length > 0 && (
        <div className="sfa-card">
          <div className="sfb-card-title">{B.insightsTitle}</div>
          <div className="sfb-insights">
            {data.insights.map((i) => (
              <div key={i.key} className={`sfb-insight ${i.tone}`}>
                <span className="sfb-insight-dot" aria-hidden="true" />
                <span>{insightText(i)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cross-account learning */}
      <div className="sfa-card">
        <div className="sfb-card-title">{B.segmentTitle}</div>
        <div className="sfa-sub" style={{ marginBlockEnd: 12 }}>{B.segmentHint}</div>
        <div className="sfb-segments">
          {(Object.keys(B.segments) as string[]).map((key) => (
            <button key={key} type="button" className={data.segment === key ? 'on' : ''} onClick={() => pickSegment(key)}>
              {(B.segments as Record<string, string>)[key]}
            </button>
          ))}
        </div>
        {data.segment && !data.benchmark && <div className="sfa-sub" style={{ marginBlockStart: 14 }}>{B.segmentThin}</div>}
        {data.benchmark && (
          <div className="sfb-bench">
            <div className="sfb-bench-row">
              <span>{t(B.benchRate, { rate: data.benchmark.deliveryRate, owners: data.benchmark.owners })}</span>
              {data.hasData && (
                <b className={data.totals.deliveryRate >= data.benchmark.deliveryRate ? 'up' : 'down'}>
                  {t(data.totals.deliveryRate >= data.benchmark.deliveryRate ? B.benchAbove : B.benchBelow, { rate: Math.abs(data.totals.deliveryRate - data.benchmark.deliveryRate) })}
                </b>
              )}
            </div>
            {data.benchmark.linkRate !== null && data.benchmark.noLinkRate !== null && (
              <div className="sfb-bench-row"><span>{t(B.benchLink, { withRate: data.benchmark.linkRate, withoutRate: data.benchmark.noLinkRate })}</span></div>
            )}
            {data.benchmark.peakHour !== null && (
              <div className="sfb-bench-row"><span>{t(B.benchHour, { from: `${String(data.benchmark.peakHour).padStart(2, '0')}:00` })}</span></div>
            )}
            {data.benchmark.topKeywords.length > 0 && (
              <div className="sfb-bench-row">
                <span>{B.benchKeywords}</span>
                <span className="sfb-chips">{data.benchmark.topKeywords.map((k) => <i key={k}>{k}</i>)}</span>
              </div>
            )}
            <div className="sfb-bench-note">{B.benchPrivacy}</div>
          </div>
        )}
      </div>

      <div className="sfb-grid">
        <Table title={B.topAutomations} col={B.colAutomation} rows={data.automations} B={B} t={t} num={num} />
        <Table title={B.topPosts} col={B.colPost} rows={data.posts} B={B} t={t} num={num} />
        <Table title={B.topKeywords} col={B.colKeyword} rows={data.keywords} B={B} t={t} num={num} />

        <div className="sfa-card">
          <div className="sfb-card-title">{B.whenTitle}</div>
          <div className="sfa-sub">{B.whenHint}</div>
          <div className="sfb-hours">
            {Array.from({ length: 24 }, (_, h) => {
              const v = data.byHour.find((x) => x.hour === h)?.triggers || 0;
              return (
                <div key={h} className="sfb-hour" title={`${String(h).padStart(2, '0')}:00 · ${v}`}>
                  <span style={{ height: `${Math.max(3, (v / hourMax) * 100)}%` }} />
                  {h % 6 === 0 && <i>{String(h).padStart(2, '0')}</i>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Table({ title, col, rows, B, t, num }: { title: string; col: string; rows: Row[]; B: any; t: any; num: (n: number) => string }) {
  return (
    <div className="sfa-card">
      <div className="sfb-card-title">{title}</div>
      {rows.length === 0 ? (
        <div className="sfa-sub">{B.noRows}</div>
      ) : (
        <table className="sfb-table">
          <thead><tr><th>{col}</th><th>{B.colTriggers}</th><th>{B.colLeads}</th><th>{B.colRate}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.permalink ? <a href={r.permalink} target="_blank" rel="noopener noreferrer">{r.label}</a> : r.label}
                  {r.sub && <small>{r.sub}</small>}
                </td>
                <td>{num(r.triggers)}</td>
                <td>{num(r.leads)}</td>
                <td><b>{r.rate}%</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
