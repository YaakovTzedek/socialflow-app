'use client';

import { useState } from 'react';

/** The code prompt. One field, and a cookie that lasts a month once it matches. */
export default function AdminGate() {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(false);
    const res = await fetch('/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (res.ok) location.reload();
    else { setError(true); setBusy(false); }
  }

  return (
    <div className="sf sfad-gate" dir="rtl">
      <form className="sfad-gate-box" onSubmit={submit}>
        <div className="sfad-gate-brand" dir="ltr">Social<span className="sf-grad-text">Flow</span></div>
        <div className="sfad-gate-title">אזור הניהול</div>
        <input
          type="password" value={code} onChange={(e) => setCode(e.target.value)}
          placeholder="קוד גישה" autoFocus autoComplete="off" className="sfad-gate-input"
        />
        {error && <div className="sf-error">הקוד שגוי.</div>}
        <button type="submit" className="sf-btn sf-btn-primary" disabled={busy || !code}>
          {busy ? 'רגע' : 'כניסה'}
        </button>
      </form>
    </div>
  );
}
