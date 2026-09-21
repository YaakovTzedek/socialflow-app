'use client';

import { useEffect, useState } from 'react';

/**
 * /mcp: what the MCP server is, mint/revoke API keys, and copy-paste setup for
 * Claude Code, claude.ai, ChatGPT and Cursor. The endpoint itself is /api/mcp.
 */

interface KeyRow { key: string; masked: string; label: string; created_at: string; last_used_at: string | null }

const TOOLS: [string, string][] = [
  ['list_pages', 'הדפים וחשבונות האינסטגרם המחוברים'],
  ['list_posts', 'הפוסטים והרילס האחרונים של חשבון, עם מספר תגובות'],
  ['list_automations', 'כל האוטומציות עם ספירות: הפעלות, הודעות פרטיות, כשלים'],
  ['create_automation', 'יצירת אוטומציה חדשה על פוסט: מילות מפתח, תגובה ציבורית, הודעה פרטית וקישור'],
  ['update_automation', 'השהיה, הפעלה, שינוי מילים או נוסחים'],
  ['delete_automation', 'מחיקה'],
  ['get_activity', 'יומן הפעילות: מי הגיב, מה נשלח, מה נכשל'],
  ['get_report', 'דוח מסכם להיום, 7 ימים או 30 ימים'],
];

export default function McpScreen() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<'claude-code' | 'claude-ai' | 'chatgpt' | 'cursor'>('claude-code');
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://socialflow-app-delta.vercel.app';

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };
  const load = async () => { setLoading(true); try { const d = await fetch('/api/mcp-keys').then((r) => r.json()); setKeys(d.keys || []); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const mint = async () => {
    setBusy(true);
    try { const d = await fetch('/api/mcp-keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: 'MCP' }) }).then((r) => r.json()); if (d.key) { setFresh(d.key); await load(); showToast('מפתח חדש נוצר'); } }
    finally { setBusy(false); }
  };
  const revoke = async (k: string) => {
    if (!confirm('לבטל את המפתח? כלים שמחוברים איתו יפסיקו לעבוד.')) return;
    await fetch(`/api/mcp-keys?key=${encodeURIComponent(k)}`, { method: 'DELETE' });
    if (fresh === k) setFresh(null);
    await load(); showToast('המפתח בוטל');
  };
  const copy = async (t: string, what = 'הועתק') => { try { await navigator.clipboard.writeText(t); showToast(what); } catch { showToast('לא הצלחתי להעתיק, סמנו והעתיקו ידנית'); } };

  const key = fresh || keys[0]?.key || '<המפתח שלך>';
  const url = `${origin}/api/mcp`;
  const urlWithKey = `${origin}/api/mcp/${key}`;
  const claudeCodeCmd = `claude mcp add --transport http socialflow ${url} --header "Authorization: Bearer ${key}"`;
  const cursorJson = `{\n  "mcpServers": {\n    "socialflow": {\n      "url": "${url}",\n      "headers": { "Authorization": "Bearer ${key}" }\n    }\n  }\n}`;

  return (
    <>
      <div className="sfa-head">
        <div>
          <div className="sfa-h">חיבור MCP</div>
          <p>מנהלים את SocialFlow מתוך שיחה עם Claude או ChatGPT: יוצרים אוטומציה, עוצרים, משנים מילים ומקבלים דוחות, בעברית.</p>
        </div>
        <button type="button" className="sfa-btn sfa-btn-primary sfa-btn-lg" onClick={mint} disabled={busy}>{busy ? 'יוצר…' : '+ מפתח חיבור חדש'}</button>
      </div>

      <div className="sfa-mcp-grid">
        <div className="sfa-card">
          <div className="sfa-eyebrow">מה זה MCP</div>
          <p className="sfa-p">MCP (Model Context Protocol) הוא תקן פתוח שמאפשר לעוזרי AI להפעיל כלים חיצוניים. SocialFlow חושף שרת MCP, כך ש-Claude או ChatGPT יכולים לקרוא את הפוסטים שלכם, ליצור אוטומציות ולשלוף דוחות, בלי לפתוח את האפליקציה.</p>
          <p className="sfa-p">איך זה נראה בפועל: כותבים בצ׳אט &quot;תפתח אוטומציה על הריל האחרון שלי: מי שכותב מדריך מקבל בפרטי את הקישור הזה&quot;, והעוזר עושה את זה דרך הכלים שלמטה. כל פעולה מופיעה מיד בדשבורד.</p>
          <div className="sfa-eyebrow" style={{ marginTop: 18 }}>הכלים שהשרת חושף</div>
          <ul className="sfa-tools">{TOOLS.map(([n, d]) => <li key={n}><code>{n}</code><span>{d}</span></li>)}</ul>
          <p className="sfa-sub" style={{ marginTop: 14 }}>הערה: יצירה ראשונה של אוטומציה לדף חייבת להיעשות באפליקציה, כדי לשמור את הרשאת הדף מ-Meta. מהפעם השנייה אפשר הכול מהצ׳אט.</p>
        </div>

        <div className="sfa-card">
          <div className="sfa-eyebrow">המפתחות שלך</div>
          {fresh && (
            <div className="sfa-keybox">
              <div className="sfa-sub">המפתח החדש. מוצג במלואו רק עכשיו, שמרו אותו:</div>
              <div className="sfa-keyrow"><code dir="ltr">{fresh}</code><button type="button" className="sfa-btn sfa-btn-cyan sfa-btn-sm" onClick={() => copy(fresh, 'המפתח הועתק')}>העתקה</button></div>
            </div>
          )}
          {loading ? <div className="sfa-loading"><span className="sfa-spinner" />טוען…</div> : keys.length === 0 ? (
            <div className="sfa-sub">עדיין אין מפתח. לחצו על &quot;מפתח חיבור חדש&quot; למעלה.</div>
          ) : (
            <div className="sfa-stack" style={{ gap: 8 }}>
              {keys.map((k) => (
                <div key={k.key} className="sfa-keyrow">
                  <code dir="ltr">{k.masked}</code>
                  <span className="sfa-sub">{k.last_used_at ? `שימוש אחרון ${new Date(k.last_used_at).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : 'עדיין לא בשימוש'}</span>
                  <button type="button" className="sfa-btn sfa-btn-danger sfa-btn-sm" onClick={() => revoke(k.key)}>ביטול</button>
                </div>
              ))}
            </div>
          )}
          <div className="sfa-eyebrow" style={{ marginTop: 18 }}>כתובת השרת</div>
          <div className="sfa-keyrow"><code dir="ltr">{url}</code><button type="button" className="sfa-btn sfa-btn-ghost sfa-btn-sm" onClick={() => copy(url)}>העתקה</button></div>
        </div>
      </div>

      <div className="sfa-card" style={{ marginTop: 16 }}>
        <div className="sfa-eyebrow">איך מחברים</div>
        <div className="sfa-tabs">
          {([['claude-code', 'Claude Code'], ['claude-ai', 'Claude.ai'], ['chatgpt', 'ChatGPT'], ['cursor', 'Cursor / אחר']] as const).map(([id, label]) => (
            <button type="button" key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {tab === 'claude-code' && (
          <div className="sfa-howto">
            <ol>
              <li>פותחים טרמינל ומדביקים את הפקודה (המפתח כבר בפנים):</li>
            </ol>
            <pre dir="ltr"><code>{claudeCodeCmd}</code></pre>
            <button type="button" className="sfa-btn sfa-btn-cyan sfa-btn-sm" onClick={() => copy(claudeCodeCmd, 'הפקודה הועתקה')}>העתקת הפקודה</button>
            <ol start={2}>
              <li>מריצים <code>claude</code> וכותבים למשל: &quot;תראה לי את האוטומציות שלי ב-SocialFlow ואיזו הכי עבדה השבוע&quot;.</li>
            </ol>
          </div>
        )}
        {tab === 'claude-ai' && (
          <div className="sfa-howto">
            <ol>
              <li>ב-claude.ai: הגדרות ← Connectors ← &quot;Add custom connector&quot;.</li>
              <li>שם: SocialFlow. כתובת השרת:</li>
            </ol>
            <pre dir="ltr"><code>{url}</code></pre>
            <button type="button" className="sfa-btn sfa-btn-cyan sfa-btn-sm" onClick={() => copy(url, 'הכתובת הועתקה')}>העתקת הכתובת</button>
            <ol start={3}>
              <li>לוחצים Connect: נפתח מסך התחברות של SocialFlow, מאשרים, וזהו. לא צריך להדביק מפתח (החיבור נעשה ב-OAuth, והוא מופיע ברשימת המפתחות כאן ואפשר לבטל אותו).</li>
            </ol>
          </div>
        )}
        {tab === 'chatgpt' && (
          <div className="sfa-howto">
            <ol>
              <li>ב-ChatGPT: Settings ← Connectors ← Advanced ← מפעילים &quot;Developer mode&quot;.</li>
              <li>לוחצים Create, שם: SocialFlow, כתובת השרת:</li>
            </ol>
            <pre dir="ltr"><code>{url}</code></pre>
            <button type="button" className="sfa-btn sfa-btn-cyan sfa-btn-sm" onClick={() => copy(url, 'הכתובת הועתקה')}>העתקת הכתובת</button>
            <ol start={3}>
              <li>Authentication: <b>OAuth</b>. לוחצים Create, ChatGPT מעביר למסך אישור של SocialFlow, מאשרים, וחוזרים. בשיחה בוחרים את SocialFlow תחת Developer mode.</li>
              <li>חלופה בלי OAuth: הכתובת עם המפתח בפנים <code dir="ltr">{urlWithKey}</code> עם &quot;No authentication&quot;.</li>
            </ol>
          </div>
        )}
        {tab === 'cursor' && (
          <div className="sfa-howto">
            <ol>
              <li>מוסיפים לקובץ ההגדרות של הכלי (למשל <code dir="ltr">~/.cursor/mcp.json</code>):</li>
            </ol>
            <pre dir="ltr"><code>{cursorJson}</code></pre>
            <button type="button" className="sfa-btn sfa-btn-cyan sfa-btn-sm" onClick={() => copy(cursorJson, 'ההגדרה הועתקה')}>העתקת ההגדרה</button>
            <ol start={2}>
              <li>כל כלי שתומך ב-MCP מסוג Streamable HTTP עובד באותה צורה: כתובת <code dir="ltr">/api/mcp</code> וכותרת Authorization עם המפתח, או הכתובת עם המפתח בפנים.</li>
            </ol>
          </div>
        )}

        <div className="sfa-eyebrow" style={{ marginTop: 20 }}>דוגמאות למה אפשר לבקש</div>
        <ul className="sfa-examples">
          <li>&quot;מה קרה היום ב-SocialFlow? כמה הודעות פרטיות נשלחו ומאיזה ריל?&quot;</li>
          <li>&quot;תפתח אוטומציה על הריל האחרון באינסטגרם: מי שכותב &apos;מדריך&apos; מקבל תגובה &apos;שלחתי בפרטי&apos; והודעה עם הקישור tzedek.me/geo&quot;</li>
          <li>&quot;תשהה את כל האוטומציות של הפודקאסט&quot;</li>
          <li>&quot;איזו אוטומציה הכי הצליחה ב-30 הימים האחרונים, ומה מילת המפתח שלה?&quot;</li>
        </ul>
      </div>

      {toast && <div className="sfa-toast">{toast}</div>}
    </>
  );
}
