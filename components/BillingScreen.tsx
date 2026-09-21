'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PLAN_ORDER, TRIAL, fmtIls, type PlanId } from '@/lib/plans';

/**
 * /billing: current plan + usage, the plan cards, and the checkout (card is
 * tokenized in the browser straight with Sumit; the server only ever sees a
 * single-use token). The ₪1 trial puts a card on file for Pro.
 */

interface Status {
  plan_id: PlanId; plan: any; source: string;
  usage: { dmsUsed: number; dmsLimit: number; activeAutomations: number; activeAutomationsLimit: number | null; accounts: number; accountsLimit: number; resetsAt: string };
  subscription: null | { id: number; plan_id: PlanId; interval: string; status: string; trial_ends_at: string | null; current_period_end: string | null; payer_email: string | null; amount_agorot: number; currency: string; canceled_at: string | null };
  catalog: Record<PlanId, any>; trial: typeof TRIAL;
  billing: { configured: boolean; test_mode: boolean; company_id: string | null; public_key: string | null };
}

const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

export default function BillingScreen({ userName }: { userName: string }) {
  const [st, setSt] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [interval, setInterval_] = useState<'month' | 'year'>('month');
  const [checkout, setCheckout] = useState<{ plan: PlanId; trial: boolean } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3200); };

  const load = async () => {
    try { const d = await fetch('/api/billing/status').then((r) => r.json()); if (d.error) throw new Error(d.error); setSt(d); }
    catch (e: any) { setErr(e.message); }
  };
  useEffect(() => { load(); }, []);

  const cancel = async () => {
    if (!confirm('לבטל את המנוי? הגישה נשארת עד סוף התקופה ששולמה, ואחר כך החשבון עובר לחינמי.')) return;
    const d = await fetch('/api/billing/cancel', { method: 'POST' }).then((r) => r.json());
    if (d.error) return showToast('שגיאה: ' + d.error);
    showToast(`המנוי בוטל. הגישה נשמרת עד ${fmtDate(d.access_until)}`); load();
  };

  if (err) return <div className="sfa-warn">שגיאה בטעינת החיוב: {err}</div>;
  if (!st) return <div className="sfa-loading"><span className="sfa-spinner" />טוען…</div>;

  const u = st.usage; const sub = st.subscription;
  const pct = (a: number, b: number | null) => (b ? Math.min(100, Math.round((a / b) * 100)) : 0);
  const trialUsed = !!sub?.trial_ends_at || st.source === 'override';

  return (
    <>
      <div className="sfa-head">
        <div>
          <div className="sfa-h">חבילה וחיוב</div>
          <p>המדידה היא לפי הודעות פרטיות שנשלחו בחודש קלנדרי. גדלת? המחיר לא זז.</p>
        </div>
      </div>

      <div className="sfa-bill-grid">
        <div className="sfa-card">
          <div className="sfa-eyebrow">החבילה שלך</div>
          <div className="sfa-plan-now">
            <b>{st.plan.name}</b>
            {st.source === 'override' && <span className="sfa-tag sfa-tag-lead">הוקצה ידנית</span>}
            {sub?.status === 'trialing' && <span className="sfa-tag sfa-tag-review">ניסיון עד {fmtDate(sub.trial_ends_at)}</span>}
            {sub?.status === 'active' && <span className="sfa-tag sfa-tag-sent">פעיל · חידוש {fmtDate(sub.current_period_end)}</span>}
            {sub?.status === 'canceled' && <span className="sfa-tag sfa-tag-unsent">בוטל · גישה עד {fmtDate(sub.current_period_end)}</span>}
          </div>
          {sub && sub.status !== 'canceled' && (
            <p className="sfa-sub">
              {sub.status === 'trialing'
                ? `ב-${fmtDate(sub.trial_ends_at)} המנוי ממשיך אוטומטית ב-${fmtIls(st.catalog[sub.plan_id].priceIls)} לחודש, אלא אם תבטל לפני. נשלח תזכורת 3 ימים לפני.`
                : `${sub.interval === 'year' ? 'חיוב שנתי' : 'חיוב חודשי'} של ${sub.currency === 'USD' ? '$' : '₪'}${(sub.amount_agorot / 100).toLocaleString()} · חשבונית נשלחת למייל ${sub.payer_email}`}
            </p>
          )}
          {sub && sub.status !== 'canceled' && st.source !== 'override' && <button type="button" className="sfa-btn sfa-btn-ghost sfa-btn-sm" style={{ marginTop: 10 }} onClick={cancel}>ביטול המנוי</button>}
        </div>

        <div className="sfa-card">
          <div className="sfa-eyebrow">שימוש החודש</div>
          <div className="sfa-usage">
            <div><div className="lbl"><span>הודעות פרטיות</span><b>{u.dmsUsed.toLocaleString()} / {u.dmsLimit.toLocaleString()}</b></div><div className="bar"><i style={{ width: pct(u.dmsUsed, u.dmsLimit) + '%' }} className={pct(u.dmsUsed, u.dmsLimit) >= 90 ? 'hot' : ''} /></div></div>
            <div><div className="lbl"><span>אוטומציות פעילות</span><b>{u.activeAutomations} / {u.activeAutomationsLimit ?? '∞'}</b></div><div className="bar"><i style={{ width: pct(u.activeAutomations, u.activeAutomationsLimit) + '%' }} /></div></div>
            <div><div className="lbl"><span>חשבונות מחוברים</span><b>{u.accounts} / {u.accountsLimit}</b></div><div className="bar"><i style={{ width: pct(u.accounts, u.accountsLimit) + '%' }} /></div></div>
          </div>
          <p className="sfa-sub" style={{ marginTop: 10 }}>המונה מתאפס ב-{fmtDate(u.resetsAt)}. MCP: {st.plan.limits.mcp ? 'פתוח' : 'מ-Pro ומעלה'}.</p>
        </div>
      </div>

      <div className="sfa-card" style={{ marginTop: 16 }}>
        <div className="sfa-step-h">
          <div className="sfa-eyebrow" style={{ margin: 0 }}>החבילות</div>
          <div className="sfa-tabs" style={{ margin: 0 }}>
            <button type="button" className={interval === 'month' ? 'on' : ''} onClick={() => setInterval_('month')}>חודשי</button>
            <button type="button" className={interval === 'year' ? 'on' : ''} onClick={() => setInterval_('year')}>שנתי · חודשיים חינם</button>
          </div>
        </div>
        <div className="sfa-plans">
          {PLAN_ORDER.map((id) => {
            const p = st.catalog[id]; const cur = st.plan_id === id;
            const price = interval === 'year' ? p.priceIlsYear : p.priceIls;
            return (
              <div key={id} className={`sfa-plan${cur ? ' cur' : ''}${id === 'pro' ? ' hi' : ''}`}>
                {id === 'pro' && <span className="sfa-plan-badge">הכי פופולרי</span>}
                <h3>{p.name}</h3>
                <div className="price"><b>{fmtIls(price)}</b><span>{id === 'free' ? '' : interval === 'year' ? ' לשנה' : ' לחודש'}</span></div>
                <p className="sfa-sub">{p.blurb}</p>
                <ul>
                  <li>{p.limits.activeAutomations === null ? 'אוטומציות ללא הגבלה' : `${p.limits.activeAutomations} אוטומציות פעילות`}</li>
                  <li>{p.limits.dmsPerMonth.toLocaleString()} הודעות פרטיות בחודש</li>
                  <li>{p.limits.accounts} {p.limits.accounts === 1 ? 'חשבון מחובר' : 'חשבונות מחוברים'}</li>
                  <li>{p.limits.seats} {p.limits.seats === 1 ? 'משתמש' : 'משתמשים'}</li>
                  <li>יומן פעילות {p.limits.logDays === 365 ? 'שנה + ייצוא' : `${p.limits.logDays} ימים`}</li>
                  <li>{p.limits.mcp ? 'MCP לקלוד ול-ChatGPT' : 'בלי MCP'}</li>
                  {p.limits.branding && <li>מיתוג "נשלח עם SocialFlow"</li>}
                </ul>
                {cur ? <button type="button" className="sfa-btn sfa-btn-ghost" disabled>החבילה הנוכחית</button>
                  : id === 'free' ? <button type="button" className="sfa-btn sfa-btn-ghost" disabled>ברירת המחדל</button>
                  : (
                    <div className="sfa-stack" style={{ gap: 8 }}>
                      {id === TRIAL.plan && interval === 'month' && !trialUsed && (
                        <button type="button" className="sfa-btn sfa-btn-primary" onClick={() => setCheckout({ plan: id, trial: true })}>30 יום ב-₪1, ואז {fmtIls(p.priceIls)} לחודש</button>
                      )}
                      <button type="button" className={`sfa-btn ${id === TRIAL.plan && interval === 'month' && !trialUsed ? 'sfa-btn-cyan' : 'sfa-btn-primary'}`} onClick={() => setCheckout({ plan: id, trial: false })}>
                        {st.plan_id !== 'free' && PLAN_ORDER.indexOf(id) < PLAN_ORDER.indexOf(st.plan_id) ? 'מעבר לחבילה' : 'שדרוג'}
                      </button>
                    </div>
                  )}
              </div>
            );
          })}
        </div>
        <p className="sfa-sub" style={{ marginTop: 12 }}>המחירים כוללים מע"מ. חשבונית מס/קבלה נשלחת אוטומטית למייל בכל חיוב. ביטול בלחיצה אחת מהעמוד הזה, בלי שיחות.</p>
      </div>

      {checkout && (
        <Checkout
          st={st} plan={checkout.plan} trial={checkout.trial} interval={interval} userName={userName}
          onClose={() => setCheckout(null)}
          onDone={(m) => { setCheckout(null); showToast(m); load(); }}
        />
      )}
      {toast && <div className="sfa-toast">{toast}</div>}
    </>
  );
}

function Checkout({ st, plan, trial, interval, userName, onClose, onDone }: { st: Status; plan: PlanId; trial: boolean; interval: 'month' | 'year'; userName: string; onClose: () => void; onDone: (m: string) => void }) {
  const p = st.catalog[plan];
  const price = interval === 'year' ? p.priceIlsYear : p.priceIls;
  const [name, setName] = useState(userName);
  const [email, setEmail] = useState(st.subscription?.payer_email || '');
  const [phone, setPhone] = useState('');
  const [card, setCard] = useState({ number: '', month: '', year: '', cvv: '', citizenId: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const ready = st.billing.configured && st.billing.company_id && st.billing.public_key;

  const pay = async () => {
    if (lock.current) return;
    setError(null);
    if (!name.trim() || !email.includes('@')) return setError('צריך שם ומייל תקין לחשבונית.');
    const num = card.number.replace(/\s/g, '');
    if (num.length < 12 || !card.month || !card.year || card.cvv.length < 3 || card.citizenId.length < 5) return setError('בדקו את פרטי הכרטיס: מספר, תוקף, CVV ותעודת זהות.');
    lock.current = true; setBusy(true);
    const safety = setTimeout(() => { lock.current = false; setBusy(false); setError('החיבור לסליקה התארך. נסו שוב.'); }, 40000);
    try {
      const body = new URLSearchParams({
        'Credentials[CompanyID]': String(st.billing.company_id), 'Credentials[APIPublicKey]': String(st.billing.public_key),
        CardNumber: num, ExpirationMonth: card.month.padStart(2, '0'), ExpirationYear: card.year.length === 2 ? '20' + card.year : card.year, CVV: card.cvv, CitizenID: card.citizenId,
      });
      const r = await fetch('https://api.sumit.co.il/creditguy/vault/tokenizesingleuse/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'Content-Language': 'Hebrew' }, body });
      const t = await r.json();
      if (t.Status !== 0 || !t.Data?.SingleUseToken) throw new Error(t.UserErrorMessage || 'פרטי הכרטיס לא התקבלו');
      const res = await fetch('/api/billing/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan_id: plan, interval, currency: 'ILS', trial, singleUseToken: t.Data.SingleUseToken, payerName: name.trim(), payerEmail: email.trim(), payerPhone: phone.trim() }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error === 'trial_used' ? 'כבר ניצלת את תקופת הניסיון' : d.error || 'החיוב נכשל');
      onDone(trial ? `ברוך הבא ל-Pro. 30 הימים הראשונים ב-₪1, ואחר כך ${fmtIls(p.priceIls)} לחודש.` : `החבילה ${p.name} פעילה. החשבונית בדרך למייל.`);
    } catch (e: any) { setError(e.message); }
    finally { clearTimeout(safety); lock.current = false; setBusy(false); }
  };

  return (
    <div className="sfa-modal-bg" onClick={onClose}>
      <div className="sfa-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sfa-eyebrow">תשלום מאובטח דרך Sumit</div>
        <h3 style={{ margin: '0 0 4px' }}>{trial ? `Pro: 30 יום ב-₪1` : `${p.name}: ${fmtIls(price)} ${interval === 'year' ? 'לשנה' : 'לחודש'}`}</h3>
        <p className="sfa-sub">{trial ? `היום מחויב ₪1. מ-${new Date(Date.now() + TRIAL.days * 86400000).toLocaleDateString('he-IL')} המנוי ממשיך ב-${fmtIls(p.priceIls)} לחודש עד שתבטל. ביטול בלחיצה מעמוד החיוב.` : 'הוראת קבע, ניתנת לביטול בכל רגע. חשבונית מס/קבלה במייל.'}</p>
        {!ready && <div className="sfa-warn">הסליקה עדיין לא הופעלה בחשבון הזה (חסרים מפתחות Sumit). אפשר לחזור לכאן אחרי ההגדרה.</div>}
        {st.billing.test_mode && ready && <div className="sfa-warn">מצב בדיקה: הכרטיס מאושר אבל לא מחויב ולא נוצרת הוראת קבע אמיתית.</div>}
        <div className="sfa-editor" style={{ marginTop: 10 }}>
          <div className="row"><div><label className="sfa-label">שם מלא לחשבונית</label><input className="sfa-input" value={name} onChange={(e) => setName(e.target.value)} /></div><div><label className="sfa-label">מייל לחשבונית</label><input className="sfa-input" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} /></div></div>
          <div className="row"><div><label className="sfa-label">טלפון (לא חובה)</label><input className="sfa-input" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} /></div><div><label className="sfa-label">תעודת זהות של בעל הכרטיס</label><input className="sfa-input" dir="ltr" inputMode="numeric" value={card.citizenId} onChange={(e) => setCard({ ...card, citizenId: e.target.value.replace(/\D/g, '') })} /></div></div>
          <div><label className="sfa-label">מספר כרטיס</label><input className="sfa-input" dir="ltr" inputMode="numeric" autoComplete="cc-number" value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value.replace(/[^\d ]/g, '') })} placeholder="0000 0000 0000 0000" /></div>
          <div className="row">
            <div><label className="sfa-label">תוקף (חודש / שנה)</label><div style={{ display: 'flex', gap: 8 }}><input className="sfa-input" dir="ltr" inputMode="numeric" placeholder="MM" maxLength={2} value={card.month} onChange={(e) => setCard({ ...card, month: e.target.value.replace(/\D/g, '') })} /><input className="sfa-input" dir="ltr" inputMode="numeric" placeholder="YYYY" maxLength={4} value={card.year} onChange={(e) => setCard({ ...card, year: e.target.value.replace(/\D/g, '') })} /></div></div>
            <div><label className="sfa-label">CVV</label><input className="sfa-input" dir="ltr" inputMode="numeric" maxLength={4} value={card.cvv} onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '') })} /></div>
          </div>
          {error && <div className="sfa-warn">{error}</div>}
          <div className="foot">
            <button type="button" className="sfa-btn sfa-btn-primary" onClick={pay} disabled={!ready}>{busy ? 'מעבד…' : trial ? 'להתחיל ב-₪1' : `לשלם ${fmtIls(price)}`}</button>
            <button type="button" className="sfa-btn sfa-btn-ghost" onClick={onClose}>ביטול</button>
          </div>
          <p className="sfa-sub" style={{ fontSize: 12 }}>פרטי הכרטיס נשלחים ישירות ל-Sumit ולא נשמרים אצל SocialFlow. בלחיצה אתם מאשרים את <a href="/terms" target="_blank" rel="noreferrer">תנאי השימוש</a>, כולל חידוש אוטומטי עד לביטול.</p>
        </div>
      </div>
    </div>
  );
}
