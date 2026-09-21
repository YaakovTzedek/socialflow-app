'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { initialsOf } from './DashboardHome';
import { useI18n } from './I18nProvider';

/** Activity log: summary stats, filters, the table and pagination. Data: /api/logs (last 100). */

interface Log { id: number; automation_id: string; automation_name?: string; platform?: string; commenter_name?: string; comment_text?: string; matched_keyword?: string; public_reply_status?: string; dm_status?: string; error_message?: string; created_at: string }

const PAGE = 10;
const statusTag = (s?: string) => `sfa-tag ${s === 'sent' ? 'sfa-tag-sent' : s === 'failed' ? 'sfa-tag-error' : 'sfa-tag-unsent'}`;

export default function LogsScreen() {
  const { m, t, dateTime, locale } = useI18n();
  const L = m.logs;
  const params = useSearchParams();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(params?.get('q') || '');
  const [auto, setAuto] = useState('all');
  const [plat, setPlat] = useState('all');
  const [status, setStatus] = useState(params?.get('status') || 'all');
  const [page, setPage] = useState(1);
  const STATUS_LABEL: Record<string, string> = { sent: L.sent, failed: L.failed, skipped: L.skipped };

  useEffect(() => { fetch('/api/logs').then((r) => r.json()).then((d) => setLogs(d.logs || [])).finally(() => setLoading(false)); }, []);
  useEffect(() => { setQ(params?.get('q') || ''); setPage(1); }, [params]);

  const autoNames = useMemo(() => Array.from(new Set(logs.map((l) => l.automation_name).filter(Boolean))) as string[], [logs]);

  const filtered = useMemo(() => logs.filter((l) => {
    if (auto !== 'all' && l.automation_name !== auto) return false;
    if (plat !== 'all' && l.platform !== plat) return false;
    if (status === 'dm_sent' && l.dm_status !== 'sent') return false;
    if (status === 'reply_sent' && l.public_reply_status !== 'sent') return false;
    if (status === 'error' && l.dm_status !== 'failed' && l.public_reply_status !== 'failed') return false;
    if (status === 'unsent' && (l.dm_status === 'sent' || l.public_reply_status === 'sent')) return false;
    if (q) { const s = q.toLowerCase(); return [l.commenter_name, l.comment_text, l.matched_keyword, l.automation_name, l.error_message].some((v) => (v || '').toLowerCase().includes(s)); }
    return true;
  }), [logs, auto, plat, status, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cur = Math.min(page, pages);
  const rows = filtered.slice((cur - 1) * PAGE, cur * PAGE);
  const stats = {
    handled: filtered.length,
    dms: filtered.filter((l) => l.dm_status === 'sent').length,
    replies: filtered.filter((l) => l.public_reply_status === 'sent').length,
    errors: filtered.filter((l) => l.dm_status === 'failed' || l.public_reply_status === 'failed').length,
  };

  const exportCsv = () => {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = filtered.map((l) => [dateTime(l.created_at, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }), l.automation_name, l.platform, l.commenter_name, l.comment_text, l.matched_keyword, l.public_reply_status, l.dm_status, l.error_message].map(esc).join(','));
    const blob = new Blob(['﻿' + [L.csvHead.map(esc).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `socialflow-log-${locale}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <div className="sfa-stats">
        <div className="sfa-stat"><small>{L.statHandled}</small><div><strong>{stats.handled}</strong></div></div>
        <div className="sfa-stat"><small>{L.statDms}</small><div><strong>{stats.dms}</strong><span>{stats.handled ? Math.round((stats.dms / stats.handled) * 100) + '%' : ''}</span></div></div>
        <div className="sfa-stat"><small>{L.statReplies}</small><div><strong>{stats.replies}</strong></div></div>
        <div className="sfa-stat"><small>{L.statErrors}</small><div><strong>{stats.errors}</strong><span className={stats.errors ? 'bad' : ''}>{stats.handled ? Math.round((stats.errors / stats.handled) * 1000) / 10 + '%' : ''}</span></div></div>
      </div>

      <div className="sfa-card sfa-filters">
        <div><label className="sfa-label">{L.fAutomation}</label>
          <select className="sfa-select" value={auto} onChange={(e) => { setAuto(e.target.value); setPage(1); }}>
            <option value="all">{L.fAll}</option>
            {autoNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div><label className="sfa-label">{L.fPlatform}</label>
          <select className="sfa-select" value={plat} onChange={(e) => { setPlat(e.target.value); setPage(1); }}>
            <option value="all">{L.fBoth}</option><option value="facebook">{m.common.facebook}</option><option value="instagram">{m.common.instagram}</option>
          </select>
        </div>
        <div><label className="sfa-label">{L.fStatus}</label>
          <select className="sfa-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="all">{L.fStatusAll}</option><option value="dm_sent">{L.fDmSent}</option><option value="reply_sent">{L.fReplySent}</option><option value="unsent">{L.fUnsent}</option><option value="error">{L.fErrors}</option>
          </select>
        </div>
        <div><label className="sfa-label">{L.fSearch}</label>
          <input className="sfa-input" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder={L.fSearchPlaceholder} />
        </div>
        <button type="button" className="sfa-btn sfa-btn-cyan" onClick={exportCsv} disabled={!filtered.length}>{L.exportCsv}</button>
      </div>

      <div className="sfa-card sfa-table">
        <div className="sfa-table-scroll">
          <div className="sfa-tr sfa-tr-h">{L.head.map((h) => <div key={h}>{h}</div>)}</div>
          {loading ? <div className="sfa-loading"><span className="sfa-spinner" />{m.common.loading}</div> : rows.length === 0 ? (
            <div className="sfa-empty" style={{ margin: 12 }}><b>{L.noResults}</b>{logs.length ? L.changeFilter : L.noActivity}</div>
          ) : rows.map((l) => (
            <div key={l.id} className="sfa-tr">
              <div className="t"><span className={`sfa-plat ${l.platform === 'instagram' ? 'sfa-plat-ig' : 'sfa-plat-fb'}`}>{l.platform === 'instagram' ? '◎' : 'f'}</span>{dateTime(l.created_at)}</div>
              <div className="u"><span className="sfa-initials">{initialsOf(l.commenter_name)}</span><span>{l.commenter_name || m.common.commenter}</span></div>
              <div className="c" title={l.comment_text}>{l.comment_text}</div>
              <div className="k">{l.matched_keyword || m.common.anyComment}</div>
              <div><span className={statusTag(l.public_reply_status)}>{STATUS_LABEL[l.public_reply_status || 'skipped'] || l.public_reply_status}</span></div>
              <div><span className={statusTag(l.dm_status)}>{STATUS_LABEL[l.dm_status || 'skipped'] || l.dm_status}</span></div>
              <div className="e" title={l.error_message || l.automation_name}>{l.error_message ? l.error_message : l.automation_name}</div>
            </div>
          ))}
        </div>
        <div className="sfa-pager">
          <small>{t(L.pager, { from: filtered.length ? (cur - 1) * PAGE + 1 : 0, to: Math.min(cur * PAGE, filtered.length), total: filtered.length })}</small>
          <div>
            <button type="button" onClick={() => setPage(cur - 1)} disabled={cur <= 1}>‹</button>
            {Array.from({ length: pages }, (_, i) => i + 1).filter((n) => Math.abs(n - cur) <= 2).map((n) => <button type="button" key={n} className={n === cur ? 'on' : ''} onClick={() => setPage(n)}>{n}</button>)}
            <button type="button" onClick={() => setPage(cur + 1)} disabled={cur >= pages}>›</button>
          </div>
        </div>
      </div>
    </>
  );
}
