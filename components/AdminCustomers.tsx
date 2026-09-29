'use client';

import { useEffect, useMemo, useState } from 'react';

/**
 * The owner's customer list and the impersonation log. Hebrew only, like the
 * rest of the admin area. Cards instead of a wide table so it reads on a phone.
 */

export interface Health { code: string; label: string; tone: 'good' | 'warn' | 'bad' | 'muted' }
export interface Customer {
  owner_id: string; name: string | null; email: string | null; page_names: string[];
  locale: string | null; segment: string | null;
  signup_at: string | null; signup_exact: boolean; last_seen_at: string | null; last_login_at: string | null; login_count: number;
  last_activity_at: string | null;
  plan_id: string; plan_name: string; plan_source: 'override' | 'subscription' | 'free'; plan_expires_at: string | null;
  pages: number; ig_accounts: number; automations: number; automations_active: number;
  mcp_keys: number; mcp_last_used_at: string | null; oauth_connections: number; affiliate_code: string | null;
  c7: number; c30: number; r7: number; r30: number; dm7: number; dm30: number; leads7: number; leads30: number;
  fail7: number; fail30: number; token7: number; total_triggers: number; last_trigger_at: string | null;
  health: Health[]; is_owner: boolean;
}
interface LogRow { id: number; kind: string; at: string; owner_id: string; owner_name: string | null; actor_id: string | null; actor_name: string | null; detail: string }
interface Data { customers: Customer[]; impersonationLog: LogRow[]; canImpersonate: boolean; impersonating: string | null }

export const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'לא ידוע';

export function ago(iso: string | null): string {
  if (!iso) return 'לא ידוע';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 2) return 'עכשיו';
  if (min < 60) return `לפני ${min} דקות`;
  const h = Math.round(min / 60);
  if (h < 24) return `לפני ${h} שעות`;
  const d = Math.round(h / 24);
  return d === 1 ? 'אתמול' : `לפני ${d} ימים`;
}

export function displayName(c: { name: string | null; page_names: string[]; owner_id: string }) {
  return c.name || c.page_names[0] || c.owner_id;
}

/** Start impersonation and go to the customer's dashboard. */
export async function enterAs(ownerId: string) {
  const res = await fetch('/api/admin/impersonate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ owner_id: ownerId }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) { alert(d.error || 'הכניסה נכשלה'); return; }
  location.href = d.redirect || '/he/dashboard';
}

const SORTS = [
  { id: 'activity', label: 'פעילות אחרונה' },
  { id: 'signup', label: 'הצטרפות' },
  { id: 'c30', label: 'תגובות ב-30 יום' },
  { id: 'leads30', label: 'לידים ב-30 יום' },
  { id: 'automations', label: 'אוטומציות' },
  { id: 'pages', label: 'עמודים' },
  { id: 'fail7', label: 'כשלים בשבוע' },
] as const;
type SortId = typeof SORTS[number]['id'];

const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);

export default function AdminCustomers({ view }: { view: 'list' | 'log' }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [plan, setPlan] = useState('all');
  const [act, setAct] = useState('all');
  const [sort, setSort] = useState<SortId>('activity');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/customers').then((r) => r.json()).then((d) => {
      if (d.error) throw new Error(d.error);
      setData(d);
    }).catch((e) => setError(e.message));
  }, []);

  const plans = useMemo(() => Array.from(new Set((data?.customers || []).map((c) => c.plan_id))).sort(), [data]);

  const list = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    let rows = data.customers.filter((c) => {
      if (plan !== 'all' && c.plan_id !== plan) return false;
      if (act === 'active7' && c.c7 === 0) return false;
      if (act === 'active30' && c.c30 === 0) return false;
      if (act === 'idle' && c.c30 > 0) return false;
      if (act === 'problems' && !c.health.some((h) => h.tone === 'bad' || h.tone === 'warn')) return false;
      if (!needle) return true;
      return [c.name, c.email, c.owner_id, c.segment, c.affiliate_code, ...c.page_names].some((v) => (v || '').toLowerCase().includes(needle));
    });
    const key: Record<SortId, (c: Customer) => number> = {
      activity: (c) => time(c.last_activity_at), signup: (c) => time(c.signup_at), c30: (c) => c.c30,
      leads30: (c) => c.leads30, automations: (c) => c.automations, pages: (c) => c.pages, fail7: (c) => c.fail7,
    };
    rows = [...rows].sort((a, b) => key[sort](b) - key[sort](a));
    return rows;
  }, [data, q, plan, act, sort]);

  if (error) return <div className="sf-error">{error}</div>;
  if (!data) return <div className="sfad-loading">טוען לקוחות</div>;

  if (view === 'log') {
    return (
      <section className="sfad-card">
        <div className="sfad-card-title">יומן צפייה כלקוח</div>
        <p className="sfad-empty" style={{ marginBlockEnd: 12 }}>כל כניסה, יציאה ופעולה שנחסמה בזמן צפייה כלקוח.</p>
        {data.impersonationLog.length === 0 ? <p className="sfad-empty">עדיין לא נכנסת לאף חשבון.</p> : (
          <div className="sfad-scroll">
            <table className="sfad-table">
              <thead><tr><th>מתי</th><th>מה</th><th>לקוח</th><th>מי</th><th>פרטים</th></tr></thead>
              <tbody>
                {data.impersonationLog.map((l) => (
                  <tr key={l.id}>
                    <td className="sfad-dim">{fmtDate(l.at)}</td>
                    <td><span className={`sfad-status ${l.kind === 'impersonation_blocked' ? 'bad' : l.kind === 'impersonation_start' ? 'good' : 'muted'}`}>
                      {l.kind === 'impersonation_start' ? 'כניסה' : l.kind === 'impersonation_stop' ? 'יציאה' : 'נחסם'}
                    </span></td>
                    <td><a href={`/he/admin/customers/${l.owner_id}`}>{l.owner_name || l.owner_id}</a></td>
                    <td>{l.actor_name || l.actor_id || ''}</td>
                    <td className="sfad-dim">{l.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  const totals = data.customers.reduce((t, c) => ({
    active7: t.active7 + (c.c7 > 0 ? 1 : 0), problems: t.problems + (c.health.some((h) => h.tone === 'bad') ? 1 : 0),
    paying: t.paying + (c.plan_source === 'subscription' ? 1 : 0),
  }), { active7: 0, problems: 0, paying: 0 });

  return (
    <section className="sfad-card">
      <div className="sfad-card-head">
        <div className="sfad-card-title">לקוחות ({data.customers.length})</div>
        <input className="sfad-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש בשם, עמוד, מזהה או מייל" />
      </div>
      <div className="sfad-mini" style={{ marginBlockEnd: 12 }}>
        <span>פעילים השבוע: <b>{totals.active7}</b></span>
        <span>עם תקלה: <b>{totals.problems}</b></span>
        <span>משלמים: <b>{totals.paying}</b></span>
      </div>
      <div className="sfad-filters">
        <label>מסלול
          <select value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option value="all">הכול</option>
            {plans.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label>פעילות
          <select value={act} onChange={(e) => setAct(e.target.value)}>
            <option value="all">הכול</option>
            <option value="active7">פעילים ב-7 ימים</option>
            <option value="active30">פעילים ב-30 יום</option>
            <option value="idle">בלי תגובות 30 יום</option>
            <option value="problems">עם תקלה או אזהרה</option>
          </select>
        </label>
        <label>מיון
          <select value={sort} onChange={(e) => setSort(e.target.value as SortId)}>
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
      </div>
      {!data.canImpersonate && (
        <p className="sfad-empty" style={{ marginBlockEnd: 10 }}>כניסה כמשתמש זמינה רק כשאתה מחובר לאפליקציה עם הפייסבוק שלך.</p>
      )}
      {list.length === 0 ? <p className="sfad-empty">אין לקוחות שמתאימים לסינון.</p> : (
        <div className="sfad-cust-grid">
          {list.map((c) => (
            <article key={c.owner_id} className={`sfad-cust${data.impersonating === c.owner_id ? ' on' : ''}`}>
              <header>
                <div className="sfad-cust-name">
                  <a href={`/he/admin/customers/${c.owner_id}`}><b>{displayName(c)}</b></a>
                  {c.is_owner && <span className="sfad-tag">אתה</span>}
                </div>
                <span className="sfad-tag">{c.plan_name}{c.plan_source === 'override' ? ' · ידני' : ''}</span>
              </header>
              <div className="sfad-dim sfad-cust-sub">
                {c.email && <span dir="ltr">{c.email}</span>}
                <span>הצטרף {c.signup_at ? new Date(c.signup_at).toLocaleDateString('he-IL') : 'לא ידוע'}{c.signup_at && !c.signup_exact ? ' (משוער)' : ''}</span>
                <span>פעילות אחרונה {ago(c.last_activity_at)}</span>
              </div>
              <div className="sfad-cust-stats">
                <div><b>{c.pages}</b><small>עמודים</small></div>
                <div><b>{c.ig_accounts}</b><small>אינסטגרם</small></div>
                <div><b>{c.automations_active}/{c.automations}</b><small>אוטומציות פעילות</small></div>
                <div><b>{c.mcp_keys + c.oauth_connections}</b><small>חיבורי MCP</small></div>
              </div>
              <table className="sfad-cust-act">
                <thead><tr><th /><th>7 ימים</th><th>30 יום</th></tr></thead>
                <tbody>
                  <tr><td>תגובות שטופלו</td><td>{c.c7}</td><td>{c.c30}</td></tr>
                  <tr><td>תגובות ציבוריות</td><td>{c.r7}</td><td>{c.r30}</td></tr>
                  <tr><td>הודעות פרטיות</td><td>{c.dm7}</td><td>{c.dm30}</td></tr>
                  <tr><td>לידים</td><td>{c.leads7}</td><td>{c.leads30}</td></tr>
                  {(c.fail7 > 0 || c.fail30 > 0) && <tr><td>כשלים</td><td>{c.fail7}</td><td>{c.fail30}</td></tr>}
                </tbody>
              </table>
              <div className="sfad-chips">
                {c.health.map((h) => <span key={h.code} className={`sfad-status ${h.tone === 'warn' ? 'warn' : h.tone}`}>{h.label}</span>)}
              </div>
              <footer>
                <a className="sf-btn sf-btn-ghost sf-btn-sm" href={`/he/admin/customers/${c.owner_id}`}>פרטים וציר זמן</a>
                {data.canImpersonate && !c.is_owner && (
                  <button type="button" className="sf-btn sf-btn-primary sf-btn-sm" disabled={busy === c.owner_id}
                    onClick={async () => { setBusy(c.owner_id); await enterAs(c.owner_id); setBusy(null); }}>
                    {busy === c.owner_id ? 'נכנס' : 'כניסה כמשתמש'}
                  </button>
                )}
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
