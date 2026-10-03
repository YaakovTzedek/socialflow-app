'use client';

import { useEffect, useState } from 'react';
import { LoginLink } from './LoginLink';
import { useI18n } from './I18nProvider';
import { useReadOnly } from './ReadOnlyContext';

/** Fired by any screen that gets Meta's "token no longer valid" answer, so the banner shows at once. */
export const CONNECTION_BROKEN_EVENT = 'sf:connection-broken';

export function isTokenErrorText(s: unknown): boolean {
  return /\(#190\)|session has been invalidated|Error validating access token|access token has expired/i.test(String(s || ''));
}

/**
 * Shown on every app screen while the Facebook connection is broken: a
 * reconnect button, and where to send the alert next time (email + WhatsApp).
 */
export function ReconnectBanner() {
  const { m } = useI18n();
  const ro = useReadOnly();
  const C = m.connection;
  const [broken, setBroken] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'invalid'>('idle');

  useEffect(() => {
    fetch('/api/connection').then((r) => r.json()).then((d) => {
      if (d.broken) setBroken(true);
      setEmail(d.notify_email || d.fallback_email || '');
      setPhone(d.notify_phone || '');
    }).catch(() => {});
    const on = () => setBroken(true);
    window.addEventListener(CONNECTION_BROKEN_EVENT, on);
    return () => window.removeEventListener(CONNECTION_BROKEN_EVENT, on);
  }, []);

  if (!broken) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('saving');
    const r = await fetch('/api/connection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, phone }) }).catch(() => null);
    setState(r?.ok ? 'saved' : 'invalid');
  };

  return (
    <div className="sfa-reconnect" role="alert">
      <div className="sfa-reconnect-head">
        <div style={{ minWidth: 0 }}>
          <div className="sfa-reconnect-title">{C.bannerTitle}</div>
          <p>{C.bannerText}</p>
        </div>
        {!ro && <LoginLink className="sfa-btn sfa-btn-primary sfa-reconnect-btn">{C.reconnect}</LoginLink>}
      </div>
      {!ro && (
        <form className="sfa-reconnect-form" onSubmit={save}>
          <div className="sfa-reconnect-q">{C.alertsTitle}</div>
          <label><span>{C.emailLabel}</span><input type="email" dir="ltr" value={email} onChange={(e) => { setEmail(e.target.value); setState('idle'); }} placeholder="name@example.com" /></label>
          <label><span>{C.phoneLabel}</span><input type="tel" dir="ltr" value={phone} onChange={(e) => { setPhone(e.target.value); setState('idle'); }} placeholder="+972 50 000 0000" /></label>
          <button type="submit" className="sfa-btn" disabled={state === 'saving'}>{C.save}</button>
          {state === 'saved' && <small className="ok">{C.saved}</small>}
          {state === 'invalid' && <small className="bad">{C.invalid}</small>}
        </form>
      )}
    </div>
  );
}
