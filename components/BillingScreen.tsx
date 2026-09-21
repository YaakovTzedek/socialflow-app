'use client';

import { useEffect, useRef, useState } from 'react';
import { PLAN_ORDER, TRIAL, fmtIls, type PlanId } from '@/lib/plans';
import { useI18n } from './I18nProvider';

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

export default function BillingScreen({ userName }: { userName: string }) {
  const { m, t, date, num, p } = useI18n();
  const B = m.billing;
  const [st, setSt] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [interval, setInterval_] = useState<'month' | 'year'>('month');
  const [checkout, setCheckout] = useState<{ plan: PlanId; trial: boolean } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (x: string) => { setToast(x); setTimeout(() => setToast(null), 3200); };

  const load = async () => {
    try { const d = await fetch('/api/billing/status').then((r) => r.json()); if (d.error) throw new Error(d.error); setSt(d); }
    catch (e: any) { setErr(e.message); }
  };
  useEffect(() => { load(); }, []);

  const cancel = async () => {
    if (!confirm(B.cancelConfirm)) return;
    const d = await fetch('/api/billing/cancel', { method: 'POST' }).then((r) => r.json());
    if (d.error) return showToast(`${m.common.error}: ${d.error}`);
    showToast(t(B.canceledToast, { date: date(d.access_until) })); load();
  };

  if (err) return <div className="sfa-warn">{t(B.loadError, { error: err })}</div>;
  if (!st) return <div className="sfa-loading"><span className="sfa-spinner" />{m.common.loading}</div>;

  const u = st.usage; const sub = st.subscription;
  const pct = (a: number, b: number | null) => (b ? Math.min(100, Math.round((a / b) * 100)) : 0);
  const trialUsed = !!sub?.trial_ends_at || st.source === 'override';
  const planName = (id: PlanId) => B.plans[id]?.name || st.catalog[id].name;
  const trialPrice = fmtIls(TRIAL.priceIls);

  return (
    <>
      <div className="sfa-head"><div><div className="sfa-h">{B.title}</div><p>{B.sub}</p></div></div>

      <div className="sfa-bill-grid">
        <div className="sfa-card">
          <div className="sfa-eyebrow">{B.yourPlan}</div>
          <div className="sfa-plan-now">
            <b>{planName(st.plan_id)}</b>
            {st.source === 'override' && <span className="sfa-tag sfa-tag-lead">{B.manual}</span>}
            {sub?.status === 'trialing' && <span className="sfa-tag sfa-tag-review">{t(B.trialUntil, { date: date(sub.trial_ends_at) })}</span>}
            {sub?.status === 'active' && <span className="sfa-tag sfa-tag-sent">{t(B.activeRenews, { date: date(sub.current_period_end) })}</span>}
            {sub?.status === 'canceled' && <span className="sfa-tag sfa-tag-unsent">{t(B.canceledUntil, { date: date(sub.current_period_end) })}</span>}
          </div>
          {sub && sub.status !== 'canceled' && (
            <p className="sfa-sub">
              {sub.status === 'trialing'
                ? t(B.trialNote, { date: date(sub.trial_ends_at), price: fmtIls(st.catalog[sub.plan_id].priceIls) })
                : `${sub.interval === 'year' ? B.yearly : B.monthly} ${t(B.invoiceTo, { amount: `${sub.currency === 'USD' ? '$' : '₪'}${num(sub.amount_agorot / 100)}`, email: sub.payer_email || '' })}`}
            </p>
          )}
          {sub && sub.status !== 'canceled' && st.source !== 'override' && <button type="button" className="sfa-btn sfa-btn-ghost sfa-btn-sm" style={{ marginTop: 10 }} onClick={cancel}>{B.cancelBtn}</button>}
        </div>

        <div className="sfa-card">
          <div className="sfa-eyebrow">{B.usageTitle}</div>
          <div className="sfa-usage">
            <div><div className="lbl"><span>{B.dms}</span><b>{num(u.dmsUsed)} / {num(u.dmsLimit)}</b></div><div className="bar"><i style={{ width: pct(u.dmsUsed, u.dmsLimit) + '%' }} className={pct(u.dmsUsed, u.dmsLimit) >= 90 ? 'hot' : ''} /></div></div>
            <div><div className="lbl"><span>{B.activeAutomations}</span><b>{u.activeAutomations} / {u.activeAutomationsLimit ?? '∞'}</b></div><div className="bar"><i style={{ width: pct(u.activeAutomations, u.activeAutomationsLimit) + '%' }} /></div></div>
            <div><div className="lbl"><span>{B.accounts}</span><b>{u.accounts} / {u.accountsLimit}</b></div><div className="bar"><i style={{ width: pct(u.accounts, u.accountsLimit) + '%' }} /></div></div>
          </div>
          <p className="sfa-sub" style={{ marginTop: 10 }}>{t(B.resets, { date: date(u.resetsAt) })} {st.plan.limits.mcp ? B.mcpOpen : B.mcpFromPro}</p>
        </div>
      </div>

      <div className="sfa-card" style={{ marginTop: 16 }}>
        <div className="sfa-step-h">
          <div className="sfa-eyebrow" style={{ margin: 0 }}>{B.plansTitle}</div>
          <div className="sfa-tabs" style={{ margin: 0 }}>
            <button type="button" className={interval === 'month' ? 'on' : ''} onClick={() => setInterval_('month')}>{B.intMonthly}</button>
            <button type="button" className={interval === 'year' ? 'on' : ''} onClick={() => setInterval_('year')}>{B.intYearly}</button>
          </div>
        </div>
        <div className="sfa-plans">
          {PLAN_ORDER.map((id) => {
            const pl = st.catalog[id]; const cur = st.plan_id === id;
            const price = interval === 'year' ? pl.priceIlsYear : pl.priceIls;
            const lim = pl.limits;
            return (
              <div key={id} className={`sfa-plan${cur ? ' cur' : ''}${id === 'pro' ? ' hi' : ''}`}>
                {id === 'pro' && <span className="sfa-plan-badge">{B.popular}</span>}
                <h3>{planName(id)}</h3>
                <div className="price"><b>{fmtIls(price)}</b><span>{id === 'free' ? '' : ' ' + (interval === 'year' ? B.perYear : B.perMonth)}</span></div>
                <p className="sfa-sub">{B.plans[id]?.blurb}</p>
                <ul>
                  <li>{lim.activeAutomations === null ? B.unlimitedAutomations : t(B.nActiveAutomations, { n: lim.activeAutomations })}</li>
                  <li>{t(B.dmsPerMonth, { n: num(lim.dmsPerMonth) })}</li>
                  <li>{t(lim.accounts === 1 ? B.connectedAccount : B.connectedAccounts, { n: lim.accounts })}</li>
                  <li>{t(lim.seats === 1 ? B.seat : B.seats, { n: lim.seats })}</li>
                  <li>{lim.logDays === 365 ? B.logYearExport : t(B.logRetention, { days: lim.logDays })}</li>
                  <li>{lim.mcp ? B.mcpYes : B.mcpNo}</li>
                  {lim.branding && <li>{B.branding}</li>}
                </ul>
                {cur ? <button type="button" className="sfa-btn sfa-btn-ghost" disabled>{B.currentPlan}</button>
                  : id === 'free' ? <button type="button" className="sfa-btn sfa-btn-ghost" disabled>{B.defaultPlan}</button>
                  : (
                    <div className="sfa-stack" style={{ gap: 8 }}>
                      {id === TRIAL.plan && interval === 'month' && !trialUsed && (
                        <button type="button" className="sfa-btn sfa-btn-primary" onClick={() => setCheckout({ plan: id, trial: true })}>{t(B.trialBtn, { trial: trialPrice, price: fmtIls(pl.priceIls) })}</button>
                      )}
                      <button type="button" className={`sfa-btn ${id === TRIAL.plan && interval === 'month' && !trialUsed ? 'sfa-btn-cyan' : 'sfa-btn-primary'}`} onClick={() => setCheckout({ plan: id, trial: false })}>
                        {st.plan_id !== 'free' && PLAN_ORDER.indexOf(id) < PLAN_ORDER.indexOf(st.plan_id) ? B.switchBtn : B.upgradeBtn}
                      </button>
                    </div>
                  )}
              </div>
            );
          })}
        </div>
        <p className="sfa-sub" style={{ marginTop: 12 }}>{B.footnote}</p>
      </div>

      {checkout && (
        <Checkout st={st} plan={checkout.plan} trial={checkout.trial} interval={interval} userName={userName} planName={planName(checkout.plan)}
          onClose={() => setCheckout(null)} onDone={(x) => { setCheckout(null); showToast(x); load(); }} termsHref={p('/terms')} />
      )}
      {toast && <div className="sfa-toast">{toast}</div>}
    </>
  );
}

function Checkout({ st, plan, trial, interval, userName, planName, onClose, onDone, termsHref }: { st: Status; plan: PlanId; trial: boolean; interval: 'month' | 'year'; userName: string; planName: string; onClose: () => void; onDone: (x: string) => void; termsHref: string }) {
  const { m, t, date, locale } = useI18n();
  const B = m.billing;
  const pl = st.catalog[plan];
  const price = interval === 'year' ? pl.priceIlsYear : pl.priceIls;
  const trialPrice = fmtIls(TRIAL.priceIls);
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
    if (!name.trim() || !email.includes('@')) return setError(B.needNameEmail);
    const numStr = card.number.replace(/\s/g, '');
    if (numStr.length < 12 || !card.month || !card.year || card.cvv.length < 3 || card.citizenId.length < 5) return setError(B.checkCard);
    lock.current = true; setBusy(true);
    const safety = setTimeout(() => { lock.current = false; setBusy(false); setError(B.slow); }, 40000);
    try {
      const body = new URLSearchParams({
        'Credentials[CompanyID]': String(st.billing.company_id), 'Credentials[APIPublicKey]': String(st.billing.public_key),
        CardNumber: numStr, ExpirationMonth: card.month.padStart(2, '0'), ExpirationYear: card.year.length === 2 ? '20' + card.year : card.year, CVV: card.cvv, CitizenID: card.citizenId,
      });
      const r = await fetch('https://api.sumit.co.il/creditguy/vault/tokenizesingleuse/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'Content-Language': locale === 'he' ? 'Hebrew' : 'English' }, body });
      const tok = await r.json();
      if (tok.Status !== 0 || !tok.Data?.SingleUseToken) throw new Error(tok.UserErrorMessage || B.cardRejected);
      const res = await fetch('/api/billing/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan_id: plan, interval, currency: 'ILS', trial, locale, singleUseToken: tok.Data.SingleUseToken, payerName: name.trim(), payerEmail: email.trim(), payerPhone: phone.trim() }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error === 'trial_used' ? B.trialUsed : d.error || B.chargeFailed);
      onDone(trial ? t(B.welcomeTrial, { trial: trialPrice, price: fmtIls(pl.priceIls) }) : t(B.planActive, { plan: planName }));
    } catch (e: any) { setError(e.message); }
    finally { clearTimeout(safety); lock.current = false; setBusy(false); }
  };

  return (
    <div className="sfa-modal-bg" onClick={onClose}>
      <div className="sfa-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sfa-eyebrow">{B.checkoutTitle}</div>
        <h3 style={{ margin: '0 0 4px' }}>{trial ? t(B.trialHeadline, { trial: trialPrice }) : t(B.planHeadline, { plan: planName, price: fmtIls(price), interval: interval === 'year' ? B.perYear : B.perMonth })}</h3>
        <p className="sfa-sub">{trial ? t(B.trialExplain, { trial: trialPrice, date: date(new Date(Date.now() + TRIAL.days * 86400000)), price: fmtIls(pl.priceIls) }) : B.subExplain}</p>
        {!ready && <div className="sfa-warn">{B.notConfigured}</div>}
        {st.billing.test_mode && ready && <div className="sfa-warn">{B.testMode}</div>}
        <div className="sfa-editor" style={{ marginTop: 10 }}>
          <div className="row"><div><label className="sfa-label">{B.fullName}</label><input className="sfa-input" value={name} onChange={(e) => setName(e.target.value)} /></div><div><label className="sfa-label">{B.email}</label><input className="sfa-input" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} /></div></div>
          <div className="row"><div><label className="sfa-label">{B.phone}</label><input className="sfa-input" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} /></div><div><label className="sfa-label">{B.idNumber}</label><input className="sfa-input" dir="ltr" inputMode="numeric" value={card.citizenId} onChange={(e) => setCard({ ...card, citizenId: e.target.value.replace(/\D/g, '') })} /></div></div>
          <div><label className="sfa-label">{B.cardNumber}</label><input className="sfa-input" dir="ltr" inputMode="numeric" autoComplete="cc-number" value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value.replace(/[^\d ]/g, '') })} placeholder="0000 0000 0000 0000" /></div>
          <div className="row">
            <div><label className="sfa-label">{B.expiry}</label><div style={{ display: 'flex', gap: 8 }}><input className="sfa-input" dir="ltr" inputMode="numeric" placeholder="MM" maxLength={2} value={card.month} onChange={(e) => setCard({ ...card, month: e.target.value.replace(/\D/g, '') })} /><input className="sfa-input" dir="ltr" inputMode="numeric" placeholder="YYYY" maxLength={4} value={card.year} onChange={(e) => setCard({ ...card, year: e.target.value.replace(/\D/g, '') })} /></div></div>
            <div><label className="sfa-label">{B.cvv}</label><input className="sfa-input" dir="ltr" inputMode="numeric" maxLength={4} value={card.cvv} onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '') })} /></div>
          </div>
          {error && <div className="sfa-warn">{error}</div>}
          <div className="foot">
            <button type="button" className="sfa-btn sfa-btn-primary" onClick={pay} disabled={!ready}>{busy ? B.processing : trial ? t(B.startTrial, { trial: trialPrice }) : t(B.pay, { price: fmtIls(price) })}</button>
            <button type="button" className="sfa-btn sfa-btn-ghost" onClick={onClose}>{m.common.cancel}</button>
          </div>
          <p className="sfa-sub" style={{ fontSize: 12 }}>{B.cardNote} <a href={termsHref} target="_blank" rel="noreferrer">{B.termsLink}</a>{B.cardNote2}</p>
        </div>
      </div>
    </div>
  );
}
