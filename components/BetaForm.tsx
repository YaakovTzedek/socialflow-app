'use client';

import { useState } from 'react';
import { useI18n } from './I18nProvider';

/**
 * Beta waiting list form. Replaces the sign-in call to action while SocialFlow
 * is closed: three fields, no account, and a phone number we can call back.
 * `website` is a honeypot, hidden from people and irresistible to form bots.
 */
export function BetaForm({ compact = false }: { compact?: boolean }) {
  const { m, locale } = useI18n();
  const B = m.beta;
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [tool, setTool] = useState('');
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!phone.trim() || !role.trim() || !tool.trim()) { setError(B.errorRequired); return; }
    setState('sending');
    try {
      const res = await fetch('/api/beta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, role, tool, website, locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error === 'bad_phone' ? B.errorPhone : B.errorGeneric); setState('idle'); return; }
      setState('done');
    } catch {
      setError(B.errorGeneric);
      setState('idle');
    }
  }

  if (state === 'done') {
    return (
      <div className="sf-beta sf-beta-done">
        <div className="sf-beta-check" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#06240f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <div>
          <div className="sf-beta-done-title">{B.successTitle}</div>
          <div className="sf-beta-done-text">{B.successText}</div>
        </div>
      </div>
    );
  }

  return (
    <form className={`sf-beta${compact ? ' sf-beta-compact' : ''}`} onSubmit={submit} noValidate>
      <label className="sf-beta-field">
        <span>{B.phone}</span>
        <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={B.phonePh} required />
      </label>
      <label className="sf-beta-field">
        <span>{B.role}</span>
        <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder={B.rolePh} required />
      </label>
      <label className="sf-beta-field">
        <span>{B.tool}</span>
        <input type="text" value={tool} onChange={(e) => setTool(e.target.value)} placeholder={B.toolPh} required />
      </label>
      <input className="sf-beta-hp" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} aria-hidden="true" />
      {error && <div className="sf-error">{error}</div>}
      <button type="submit" className="sf-btn sf-btn-primary sf-btn-lg" disabled={state === 'sending'}>
        {state === 'sending' ? B.sending : B.submit}
      </button>
      <div className="sf-beta-note">{B.privacy}</div>
    </form>
  );
}
