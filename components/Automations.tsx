'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Page {
  id: string;
  name: string;
  instagram?: { id: string; username?: string } | null;
}

interface Automation {
  id: string;
  name: string;
  platform: string;
  page_id: string;
  page_name?: string;
  post_id?: string;
  post_scope: string;
  keywords: string[];
  match_type: string;
  public_reply_enabled: boolean;
  public_replies: string[];
  dm_enabled: boolean;
  dm_message?: string;
  dm_link?: string;
  status: string;
  trigger_count: number;
}

const empty = {
  name: '',
  platform: 'facebook',
  page_id: '',
  post_scope: 'all_posts',
  post_id: '',
  keywords: '',
  match_type: 'contains',
  public_reply_enabled: true,
  public_reply: '',
  dm_enabled: true,
  dm_message: '',
  dm_link: '',
  once_per_user: true,
};

export default function Automations({ userName }: { userName: string }) {
  const [pages, setPages] = useState<Page[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [pRes, aRes] = await Promise.all([
        fetch('/api/pages'),
        fetch('/api/automations'),
      ]);
      const pData = await pRes.json();
      const aData = await aRes.json();
      setPages(pData.pages || []);
      if (aData.error === 'db_not_configured') setDbError(true);
      setAutomations(aData.automations || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const update = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name || !form.page_id) {
      showToast('יש למלא שם וחשבון');
      return;
    }
    setSaving(true);
    try {
      // Subscribe the page to webhooks first (best-effort).
      await fetch(`/api/pages/${form.page_id}/subscribe`, { method: 'POST' });

      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          platform: form.platform,
          page_id: form.page_id,
          post_scope: form.post_scope,
          post_id: form.post_scope === 'specific_post' ? form.post_id : null,
          keywords: form.keywords
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean),
          match_type: form.match_type,
          public_reply_enabled: form.public_reply_enabled,
          public_replies: form.public_reply
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          dm_enabled: form.dm_enabled,
          dm_message: form.dm_message || null,
          dm_link: form.dm_link || null,
          once_per_user: form.once_per_user,
          status: 'active',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed');
      showToast('✅ האוטומציה נוצרה');
      setShowForm(false);
      setForm({ ...empty });
      load();
    } catch (e: any) {
      showToast('שגיאה: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (a: Automation) => {
    const status = a.status === 'active' ? 'paused' : 'active';
    await fetch(`/api/automations/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setAutomations((prev) =>
      prev.map((x) => (x.id === a.id ? { ...x, status } : x))
    );
  };

  const remove = async (id: string) => {
    await fetch(`/api/automations/${id}`, { method: 'DELETE' });
    setAutomations((prev) => prev.filter((x) => x.id !== id));
    showToast('נמחק');
  };

  const loadLogs = async () => {
    if (showLogs) {
      setShowLogs(false);
      return;
    }
    setShowLogs(true);
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      setLogs(data.logs || []);
    } finally {
      setLoadingLogs(false);
    }
  };

  const selectedPage = pages.find((p) => p.id === form.page_id);

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none">אוטומציות</h1>
              <p className="text-xs text-gray-400 mt-0.5">תגובה אוטומטית + DM</p>
            </div>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-gray-500 hover:text-gray-800">
              תגובות ידניות
            </Link>
            <a href="/api/auth/logout" className="text-gray-500 hover:text-gray-800">
              התנתק
            </a>
          </nav>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {dbError && (
          <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
            ⚠️ מסד הנתונים עדיין לא מחובר. צריך לחבר Vercel Postgres כדי ליצור
            אוטומציות. (ראה הוראות בצ׳אט)
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">האוטומציות שלך</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-5 py-2.5"
          >
            {showForm ? 'בטל' : '+ אוטומציה חדשה'}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 space-y-4">
            <Field label="שם האוטומציה">
              <input className="inp" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder='לדוגמה: "לינק לקורס"' />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="חשבון">
                <select className="inp" value={form.page_id} onChange={(e) => update('page_id', e.target.value)}>
                  <option value="">בחר דף...</option>
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="היקף">
                <select className="inp" value={form.post_scope} onChange={(e) => update('post_scope', e.target.value)}>
                  <option value="all_posts">כל הפוסטים</option>
                  <option value="specific_post">פוסט ספציפי</option>
                </select>
              </Field>
            </div>

            {form.post_scope === 'specific_post' && (
              <Field label="Post ID">
                <input className="inp" dir="ltr" value={form.post_id} onChange={(e) => update('post_id', e.target.value)} placeholder="123456_789012" />
              </Field>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Field label="מילות מפתח (מופרדות בפסיק)">
                <input className="inp" value={form.keywords} onChange={(e) => update('keywords', e.target.value)} placeholder="מעוניין, פרטים, לינק" />
              </Field>
              <Field label="סוג התאמה">
                <select className="inp" value={form.match_type} onChange={(e) => update('match_type', e.target.value)}>
                  <option value="contains">מכיל</option>
                  <option value="exact">מדויק</option>
                </select>
              </Field>
            </div>
            <p className="text-xs text-gray-400 -mt-2">השאר ריק = יגיב לכל תגובה</p>

            <Field label="תגובות ציבוריות (שורה לכל וריאציה)">
              <textarea className="inp h-20" value={form.public_reply} onChange={(e) => update('public_reply', e.target.value)} placeholder={'שלחנו לך פרטים בפרטי! 🙌\nבדוק את ההודעות שלך 💬'} />
            </Field>

            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={form.dm_enabled} onChange={(e) => update('dm_enabled', e.target.checked)} />
                שלח הודעה בפרטי (DM) — פייסבוק
              </label>
              {form.dm_enabled && (
                <>
                  <textarea className="inp h-20" value={form.dm_message} onChange={(e) => update('dm_message', e.target.value)} placeholder="היי! הנה הלינק שביקשת:" />
                  <input className="inp" dir="ltr" value={form.dm_link} onChange={(e) => update('dm_link', e.target.value)} placeholder="https://your-link.com" />
                </>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.once_per_user} onChange={(e) => update('once_per_user', e.target.checked)} />
              פעם אחת לכל משתמש
            </label>

            <button onClick={save} disabled={saving} className="w-full rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-medium py-3 disabled:opacity-50">
              {saving ? 'שומר...' : 'צור אוטומציה'}
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm p-8 justify-center">
            <span className="spinner" /> טוען...
          </div>
        ) : automations.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center text-gray-400">
            עדיין אין אוטומציות. צור את הראשונה שלך! 🚀
          </div>
        ) : (
          <div className="space-y-3">
            {automations.map((a) => (
              <div key={a.id} className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{a.name}</h3>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${a.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {a.status === 'active' ? 'פעיל' : 'מושהה'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{a.page_name}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {a.keywords?.length ? a.keywords.map((k) => (
                        <span key={k} className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-md">{k}</span>
                      )) : <span className="text-xs text-gray-400">כל תגובה</span>}
                    </div>
                    <div className="flex gap-3 mt-2 text-xs text-gray-400">
                      {a.public_reply_enabled && <span>💬 תגובה</span>}
                      {a.dm_enabled && <span>✉️ DM</span>}
                      <span>· הופעל {a.trigger_count} פעמים</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggle(a)} className="text-sm text-brand-600 hover:underline">
                      {a.status === 'active' ? 'השהה' : 'הפעל'}
                    </button>
                    <button onClick={() => remove(a.id)} className="text-sm text-red-500 hover:underline">
                      מחק
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recent activity / logs */}
        <div className="mt-8">
          <button
            onClick={loadLogs}
            className="text-sm font-semibold text-gray-600 hover:text-gray-900"
          >
            {showLogs ? '▾ הסתר פעילות אחרונה' : '▸ הצג פעילות אחרונה'}
          </button>

          {showLogs && (
            <div className="mt-3">
              {loadingLogs ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm p-4">
                  <span className="spinner" /> טוען...
                </div>
              ) : logs.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
                  עדיין אין פעילות. כשמישהו יגיב ויפעיל אוטומציה — זה יופיע כאן.
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs">
                      <tr>
                        <th className="text-right p-3 font-medium">אוטומציה</th>
                        <th className="text-right p-3 font-medium">תגובה</th>
                        <th className="text-right p-3 font-medium">מילה</th>
                        <th className="text-center p-3 font-medium">תגובה ציבורית</th>
                        <th className="text-center p-3 font-medium">DM</th>
                        <th className="text-right p-3 font-medium">מתי</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((l) => (
                        <tr key={l.id} className="border-t border-gray-100">
                          <td className="p-3 font-medium">{l.automation_name}</td>
                          <td className="p-3 text-gray-600 max-w-[200px] truncate">
                            {l.commenter_name ? `${l.commenter_name}: ` : ''}
                            {l.comment_text}
                          </td>
                          <td className="p-3 text-gray-500">{l.matched_keyword || '—'}</td>
                          <td className="p-3 text-center"><StatusDot s={l.public_reply_status} /></td>
                          <td className="p-3 text-center"><StatusDot s={l.dm_status} /></td>
                          <td className="p-3 text-gray-400 text-xs whitespace-nowrap">
                            {new Date(l.created_at).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}

      <style jsx>{`
        :global(.inp) {
          width: 100%;
          border: 1px solid #e5e7eb;
          border-radius: 0.75rem;
          padding: 0.6rem 0.9rem;
          font-size: 0.875rem;
          outline: none;
        }
        :global(.inp:focus) {
          border-color: #6366f1;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function StatusDot({ s }: { s?: string }) {
  const map: Record<string, { c: string; t: string }> = {
    sent: { c: 'bg-emerald-500', t: 'נשלח' },
    failed: { c: 'bg-red-500', t: 'נכשל' },
    skipped: { c: 'bg-gray-300', t: 'דולג' },
  };
  const x = map[s || 'skipped'] || map.skipped;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
      <span className={`w-2 h-2 rounded-full ${x.c}`} /> {x.t}
    </span>
  );
}
