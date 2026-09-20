'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { initialsOf } from './DashboardHome';

/** Activity log (screen 3 of the Claude Design "SocialFlow App"): summary
 *  stats, filters, the table and pagination. Data: /api/logs (last 100). */

interface Log { id: number; automation_id: string; automation_name?: string; platform?: string; commenter_name?: string; comment_text?: string; matched_keyword?: string; public_reply_status?: string; dm_status?: string; error_message?: string; created_at: string }

const PAGE = 10;
const STATUS_LABEL: Record<string, string> = { sent: 'נשלחה', failed: 'שגיאה', skipped: 'לא נשלחה' };
const statusTag = (s?: string) => `sfa-tag ${s === 'sent' ? 'sfa-tag-sent' : s === 'failed' ? 'sfa-tag-error' : 'sfa-tag-unsent'}`;

export default function LogsScreen() {
  const params = useSearchParams();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(params?.get('q') || '');
  const [auto, setAuto] = useState('all');
  const [plat, setPlat] = useState('all');
  const [status, setStatus] = useState(params?.get('status') || 'all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch('/api/logs').then((r) => r.json()).then((d) => setLogs(d.logs || [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { setQ(params?.get('q') || ''); setPage(1); }, [params]);

  const autoNames = useMemo(() => Array.from(new Set(logs.map((l) => l.automation_name).filter(Boolean))) as string[], [logs]);

  const filtered = useMemo(() => logs.filter((l) => {
    if (auto !== 'all' && l.automation_name !== auto) return false;
    if (plat !== 'all' && l.platform !== plat) return false;
    if (status === 'dm_sent' && l.dm_status !== 'sent') return false;
    if (status === 'reply_sent' && l.public_reply_status !== 'sent') return false;
    if (status === 'error' && l.dm_status !== 'failed' && l.public_reply_status !== 'failed') return false;
    if (status === 'unsent' && (l.dm_status === 'sent' || l.public_reply_status === 'sent')) return false;
    if (q) {
      const s = q.toLowerCase();
      return [l.commenter_name, l.comment_text, l.matched_keyword, l.automation_name, l.error_message].some((v) => (v || '').toLowerCase().includes(s));
    }
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
    const head = ['זמן', 'אוטומציה', 'פלטפורמה', 'מגיב', 'תגובה', 'מילת מפתח', 'תגובה ציבורית', 'הודעה פרטית', 'שגיאה'];
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = filtered.map((l) => [new Date(l.created_at).toLocaleString('he-IL'), l.automation_name, l.platform, l.commenter_name, l.comment_text, l.matched_keyword, l.public_reply_status, l.dm_status, l.error_message].map(esc).join(','));
    const blob = new Blob(['﻿' + [head.map(esc).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `socialflow-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <div className="sfa-stats">
        <div className="sfa-stat"><small>תגובות שטופלו</small><div><strong>{stats.handled}</strong></div></div>
        <div className="sfa-stat"><small>הודעות פרטיות שנשלחו</small><div><strong>{stats.dms}</strong><span>{stats.handled ? Math.round((stats.dms / stats.handled) * 100) + '%' : ''}</span></div></div>
        <div className="sfa-stat"><small>תגובות ציבוריות שנשלחו</small><div><strong>{stats.replies}</strong></div></div>
        <div className="sfa-stat"><small>שגיאות</small><div><strong>{stats.errors}</strong><span className={stats.errors ? 'bad' : ''}>{stats.handled ? Math.round((stats.errors / stats.handled) * 1000) / 10 + '%' : ''}</span></div></div>
      </div>

      <div className="sfa-card sfa-filters">
        <div><label className="sfa-label">אוטומציה</label>
          <select className="sfa-select" value={auto} onChange={(e) => { setAuto(e.target.value); setPage(1); }}>
            <option value="all">כל האוטומציות</option>
            {autoNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div><label className="sfa-label">פלטפורמה</label>
          <select className="sfa-select" value={plat} onChange={(e) => { setPlat(e.target.value); setPage(1); }}>
            <option value="all">פייסבוק ואינסטגרם</option><option value="facebook">פייסבוק</option><option value="instagram">אינסטגרם</option>
          </select>
        </div>
        <div><label className="sfa-label">סטטוס</label>
          <select className="sfa-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="all">הכל</option><option value="dm_sent">נשלחה הודעה פרטית</option><option value="reply_sent">נשלחה תגובה ציבורית</option><option value="unsent">לא נשלח דבר</option><option value="error">שגיאות</option>
          </select>
        </div>
        <div><label className="sfa-label">חיפוש</label>
          <input className="sfa-input" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="מגיב, טקסט, מילת מפתח" />
        </div>
        <button type="button" className="sfa-btn sfa-btn-cyan" onClick={exportCsv} disabled={!filtered.length}>ייצוא CSV</button>
      </div>

      <div className="sfa-card sfa-table">
        <div className="sfa-table-scroll">
          <div className="sfa-tr sfa-tr-h"><div>זמן</div><div>מגיב</div><div>תגובה</div><div>מילת מפתח</div><div>תגובה ציבורית</div><div>הודעה פרטית</div><div>אוטומציה / שגיאה</div></div>
          {loading ? <div className="sfa-loading"><span className="sfa-spinner" />טוען…</div> : rows.length === 0 ? (
            <div className="sfa-empty" style={{ margin: 12 }}><b>אין תוצאות</b>{logs.length ? 'נסה לשנות את הסינון.' : 'עדיין אין פעילות. כשמישהו יגיב ויפעיל אוטומציה, זה יופיע כאן.'}</div>
          ) : rows.map((l) => (
            <div key={l.id} className="sfa-tr">
              <div className="t"><span className={`sfa-plat ${l.platform === 'instagram' ? 'sfa-plat-ig' : 'sfa-plat-fb'}`}>{l.platform === 'instagram' ? '◎' : 'f'}</span>{new Date(l.created_at).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
              <div className="u"><span className="sfa-initials">{initialsOf(l.commenter_name)}</span><span>{l.commenter_name || 'מגיב'}</span></div>
              <div className="c" title={l.comment_text}>{l.comment_text}</div>
              <div className="k">{l.matched_keyword || 'כל תגובה'}</div>
              <div><span className={statusTag(l.public_reply_status)}>{STATUS_LABEL[l.public_reply_status || 'skipped'] || l.public_reply_status}</span></div>
              <div><span className={statusTag(l.dm_status)}>{STATUS_LABEL[l.dm_status || 'skipped'] || l.dm_status}</span></div>
              <div className="e" title={l.error_message || l.automation_name}>{l.error_message ? l.error_message : l.automation_name}</div>
            </div>
          ))}
        </div>
        <div className="sfa-pager">
          <small>מציג {filtered.length ? (cur - 1) * PAGE + 1 : 0}‑{Math.min(cur * PAGE, filtered.length)} מתוך {filtered.length} תוצאות</small>
          <div>
            <button type="button" onClick={() => setPage(cur - 1)} disabled={cur <= 1}>›</button>
            {Array.from({ length: pages }, (_, i) => i + 1).filter((n) => Math.abs(n - cur) <= 2).map((n) => <button type="button" key={n} className={n === cur ? 'on' : ''} onClick={() => setPage(n)}>{n}</button>)}
            <button type="button" onClick={() => setPage(cur + 1)} disabled={cur >= pages}>‹</button>
          </div>
        </div>
      </div>
    </>
  );
}
