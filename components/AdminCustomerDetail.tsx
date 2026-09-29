'use client';

import { useEffect, useMemo, useState } from 'react';
import { ago, displayName, enterAs, fmtDate, type Customer } from './AdminCustomers';

/** One customer: summary, timeline of what they did, their automations and pages. Owner only. */

interface TimelineItem { at: string; kind: string; title: string; detail?: string | null; tone?: 'good' | 'warn' | 'bad' | 'muted' }
interface Detail {
  summary: Customer;
  timeline: TimelineItem[];
  automations: { id: string; name: string; platform: string; page_name: string | null; post_scope: string; keywords: string[]; status: string; dm_enabled: boolean; public_reply_enabled: boolean; trigger_count: number; created_at: string; c7: number; c30: number; dm30: number; fail30: number; leads: number; last_trigger_at: string | null }[];
  pages: { page_id: string; name: string | null; updated_at: string; picture: string | null; fans: number | null; ig_id: string | null; ig_username: string | null; ig_followers: number | null }[];
  keys: { masked: string; label: string | null; created_at: string; last_used_at: string | null; revoked_at: string | null }[];
  oauth: { client: string | null; created_at: string; revoked_at: string | null }[];
  subscriptions: { id: number; plan_id: string; interval: string; status: string; payer_name: string | null; payer_email: string | null; amount_agorot: number; currency: string; current_period_end: string | null; created_at: string }[];
  overrides: { plan_id: string; note: string | null; created_at: string; expires_at: string | null }[];
  canImpersonate: boolean;
}

const KINDS = [
  { id: 'all', label: 'הכול' },
  { id: 'setup', label: 'הגדרות וחיבורים' },
  { id: 'activity', label: 'פעילות יומית' },
  { id: 'error', label: 'שגיאות' },
  { id: 'billing', label: 'תשלומים' },
  { id: 'access', label: 'כניסות וצפייה' },
] as const;
type KindId = typeof KINDS[number]['id'];
const GROUP: Record<string, KindId> = {
  signup: 'setup', automation_created: 'setup', automation_updated: 'setup', automation_deleted: 'setup', page: 'setup', mcp_key: 'setup', oauth: 'setup', affiliate: 'setup',
  activity: 'activity', error: 'error', billing: 'billing',
  login: 'access', impersonation_start: 'access', impersonation_stop: 'access', impersonation_blocked: 'access',
};
const SCOPE: Record<string, string> = { specific_post: 'פוסט מסוים', all_posts: 'כל הפוסטים', story_replies: 'תגובות לסטורי', dm_inbound: 'הודעה נכנסת' };

export default function AdminCustomerDetail({ id }: { id: string }) {
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<KindId>('all');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/customers/${encodeURIComponent(id)}`).then((r) => r.json()).then((x) => {
      if (x.error) throw new Error(x.error === 'customer_not_found' ? 'הלקוח לא נמצא.' : x.error);
      setD(x);
    }).catch((e) => setError(e.message));
  }, [id]);

  const timeline = useMemo(() => (d ? d.timeline.filter((t) => kind === 'all' || GROUP[t.kind] === kind) : []), [d, kind]);

  if (error) return <div className="sf-error">{error}</div>;
  if (!d) return <div className="sfad-loading">טוען</div>;
  const c = d.summary;

  return (
    <>
      <section className="sfad-card">
        <div className="sfad-card-head">
          <div className="sfad-card-title">{displayName(c)}</div>
          <span className="sfad-tag">{c.plan_name}{c.plan_source === 'override' ? ' · ידני' : ''}</span>
          {d.canImpersonate && !c.is_owner && (
            <button type="button" className="sf-btn sf-btn-primary sf-btn-sm" disabled={busy}
              onClick={async () => { setBusy(true); await enterAs(c.owner_id); setBusy(false); }}>
              {busy ? 'נכנס' : 'כניסה כמשתמש'}
            </button>
          )}
        </div>
        <div className="sfad-mini">
          <span>מזהה: <b dir="ltr">{c.owner_id}</b></span>
          {c.email && <span>מייל: <b dir="ltr">{c.email}</b></span>}
          <span>הצטרף: <b>{c.signup_at ? new Date(c.signup_at).toLocaleDateString('he-IL') : 'לא ידוע'}</b>{c.signup_at && !c.signup_exact ? ' (משוער)' : ''}</span>
          <span>פעילות אחרונה: <b>{ago(c.last_activity_at)}</b></span>
          <span>נראה באפליקציה: <b>{c.last_seen_at ? ago(c.last_seen_at) : 'לא נמדד עדיין'}</b></span>
          <span>התחברויות: <b>{c.login_count || 'לא נמדד עדיין'}</b></span>
          {c.locale && <span>שפה: <b>{c.locale}</b></span>}
          {c.segment && <span>תחום: <b>{c.segment}</b></span>}
          {c.affiliate_code && <span>שותף: <b>{c.affiliate_code}</b></span>}
          {c.plan_expires_at && <span>המסלול עד: <b>{new Date(c.plan_expires_at).toLocaleDateString('he-IL')}</b></span>}
        </div>
        <div className="sfad-chips" style={{ marginBlockStart: 12 }}>
          {c.health.map((h) => <span key={h.code} className={`sfad-status ${h.tone}`}>{h.label}</span>)}
        </div>
      </section>

      <div className="sfad-kpis">
        <Kpi value={c.c30} label="תגובות שטופלו ב-30 יום" sub={`${c.c7} בשבוע`} />
        <Kpi value={c.dm30} label="הודעות פרטיות ב-30 יום" sub={`${c.dm7} בשבוע`} />
        <Kpi value={c.leads30} label="לידים ב-30 יום" sub={`${c.leads7} בשבוע`} />
        <Kpi value={c.fail30} label="כשלים ב-30 יום" sub={`${c.fail7} בשבוע`} tone={c.fail7 ? 'warn' : undefined} />
      </div>

      <section className="sfad-card">
        <div className="sfad-card-head">
          <div className="sfad-card-title">ציר זמן</div>
        </div>
        <div className="sfad-tabs">
          {KINDS.map((k) => <button key={k.id} type="button" className={k.id === kind ? 'on' : ''} onClick={() => setKind(k.id)}>{k.label}</button>)}
        </div>
        {timeline.length === 0 ? <p className="sfad-empty">אין אירועים בסינון הזה.</p> : (
          <ol className="sfad-timeline">
            {timeline.map((t, i) => (
              <li key={`${t.at}-${i}`} className={t.tone || 'muted'}>
                <time>{t.kind === 'activity' ? new Date(t.at).toLocaleDateString('he-IL') : fmtDate(t.at)}</time>
                <div>
                  <b>{t.title}</b>
                  {t.detail && <small>{t.detail}</small>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="sfad-card">
        <div className="sfad-card-title">אוטומציות ({d.automations.length})</div>
        {d.automations.length === 0 ? <p className="sfad-empty">אין אוטומציות.</p> : (
          <div className="sfad-scroll">
            <table className="sfad-table">
              <thead><tr><th>שם</th><th>עמוד</th><th>היקף</th><th>מילים</th><th>סטטוס</th><th>7 ימים</th><th>30 יום</th><th>הודעות 30</th><th>לידים</th><th>אחרונה</th><th>נוצרה</th></tr></thead>
              <tbody>
                {d.automations.map((a) => (
                  <tr key={a.id}>
                    <td><b>{a.name}</b></td>
                    <td className="sfad-dim">{a.page_name || ''} · {a.platform === 'instagram' ? 'אינסטגרם' : 'פייסבוק'}</td>
                    <td className="sfad-dim">{SCOPE[a.post_scope] || a.post_scope}</td>
                    <td>{a.keywords?.length ? a.keywords.join(', ') : 'כל תגובה'}</td>
                    <td><span className={`sfad-status ${a.status === 'active' ? 'good' : 'muted'}`}>{a.status === 'active' ? 'פעילה' : 'מושהית'}</span></td>
                    <td>{a.c7}</td>
                    <td>{a.c30}</td>
                    <td>{a.dm30}{a.fail30 ? <span className="sfad-dim"> ({a.fail30} נכשלו)</span> : null}</td>
                    <td><b>{a.leads}</b></td>
                    <td className="sfad-dim">{a.last_trigger_at ? ago(a.last_trigger_at) : 'אף פעם'}</td>
                    <td className="sfad-dim">{new Date(a.created_at).toLocaleDateString('he-IL')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="sfad-card">
        <div className="sfad-card-title">עמודים וחשבונות ({d.pages.length})</div>
        {d.pages.length === 0 ? <p className="sfad-empty">אין עמודים מחוברים.</p> : (
          <div className="sfad-scroll">
            <table className="sfad-table">
              <thead><tr><th>עמוד</th><th>עוקבים</th><th>אינסטגרם</th><th>עודכן</th></tr></thead>
              <tbody>
                {d.pages.map((p) => (
                  <tr key={p.page_id}>
                    <td><b>{p.name || p.page_id}</b></td>
                    <td>{p.fans ?? ''}</td>
                    <td dir="ltr">{p.ig_username ? `@${p.ig_username}` : p.ig_id ? 'מחובר' : ''}{p.ig_followers != null ? ` · ${p.ig_followers}` : ''}</td>
                    <td className="sfad-dim">{fmtDate(p.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="sfad-card">
        <div className="sfad-card-title">חיבורי MCP</div>
        {d.keys.length === 0 && d.oauth.length === 0 ? <p className="sfad-empty">לא חיבר את Claude או ChatGPT.</p> : (
          <div className="sfad-scroll">
            <table className="sfad-table">
              <thead><tr><th>סוג</th><th>שם</th><th>נוצר</th><th>שימוש אחרון</th><th>סטטוס</th></tr></thead>
              <tbody>
                {d.keys.map((k) => (
                  <tr key={k.masked + k.created_at}>
                    <td>מפתח</td><td dir="ltr">{k.label} {k.masked}</td><td className="sfad-dim">{fmtDate(k.created_at)}</td>
                    <td className="sfad-dim">{k.last_used_at ? ago(k.last_used_at) : 'אף פעם'}</td>
                    <td><span className={`sfad-status ${k.revoked_at ? 'muted' : 'good'}`}>{k.revoked_at ? 'בוטל' : 'פעיל'}</span></td>
                  </tr>
                ))}
                {d.oauth.map((o, i) => (
                  <tr key={`o${i}`}>
                    <td>OAuth</td><td>{o.client || 'לקוח MCP'}</td><td className="sfad-dim">{fmtDate(o.created_at)}</td><td className="sfad-dim" />
                    <td><span className={`sfad-status ${o.revoked_at ? 'muted' : 'good'}`}>{o.revoked_at ? 'נותק' : 'פעיל'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="sfad-card">
        <div className="sfad-card-title">מסלול ותשלומים</div>
        {d.subscriptions.length === 0 && d.overrides.length === 0 ? <p className="sfad-empty">מסלול חינמי, בלי מנוי ובלי הענקה ידנית.</p> : (
          <div className="sfad-scroll">
            <table className="sfad-table">
              <thead><tr><th>סוג</th><th>מסלול</th><th>סטטוס</th><th>סכום</th><th>עד</th><th>נוצר</th></tr></thead>
              <tbody>
                {d.overrides.map((o) => (
                  <tr key={`ov${o.created_at}`}>
                    <td>הענקה ידנית</td><td>{o.plan_id}</td><td className="sfad-dim">{o.note || ''}</td><td />
                    <td className="sfad-dim">{o.expires_at ? new Date(o.expires_at).toLocaleDateString('he-IL') : 'ללא תפוגה'}</td>
                    <td className="sfad-dim">{fmtDate(o.created_at)}</td>
                  </tr>
                ))}
                {d.subscriptions.map((s) => (
                  <tr key={s.id}>
                    <td>מנוי</td><td>{s.plan_id} · {s.interval === 'year' ? 'שנתי' : 'חודשי'}</td>
                    <td><span className={`sfad-status ${s.status === 'active' || s.status === 'trialing' ? 'good' : s.status === 'past_due' ? 'bad' : 'muted'}`}>{s.status}</span></td>
                    <td dir="ltr">{(s.amount_agorot / 100).toLocaleString('he-IL')} {s.currency}</td>
                    <td className="sfad-dim">{s.current_period_end ? new Date(s.current_period_end).toLocaleDateString('he-IL') : ''}</td>
                    <td className="sfad-dim">{fmtDate(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
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
