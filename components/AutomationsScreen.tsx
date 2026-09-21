'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Automations list + the six-step builder (screen 2 of the Claude Design
 * "SocialFlow App"). Same API as before (/api/automations, /api/pages, posts
 * and media endpoints); the builder replaces the old single form.
 */

interface Page { id: string; name: string; picture?: string; instagram?: { id: string; username?: string; picture?: string } | null }
interface Stats { triggers: number; dms_sent: number; replies_sent: number; failed: number; last_at: string | null }
interface PostInfo { id: string; permalink?: string; comments_count?: number | null; like_count?: number | null; text?: string; image?: string }
interface Automation { id: string; name: string; platform: string; page_id: string; page_name?: string; post_id?: string; post_scope: string; keywords: string[]; match_type: string; public_reply_enabled: boolean; public_replies: string[]; dm_enabled: boolean; dm_message?: string; dm_link?: string; once_per_user: boolean; status: string; trigger_count: number; created_at: string; stats?: Stats; post?: PostInfo | null }
interface Target { key: string; platform: 'facebook' | 'instagram'; page_id: string; ig_id: string | null; name: string; picture?: string }
interface PostItem { id: string; text: string; image?: string; likes?: number | null; comments?: number | null }

const VARS = ['{שם הפונה}', '{מילת המפתח}', '{שם הדף}'];
const DEFAULT_REPLIES = ['תודה על התגובה! שלחנו לך את כל הפרטים בהודעה פרטית 💙'];

export default function AutomationsScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const [pages, setPages] = useState<Page[]>([]);
  const [autos, setAutos] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [building, setBuilding] = useState(params?.get('new') === '1');
  const [editing, setEditing] = useState<string | null>(null);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  const load = async () => {
    setLoading(true);
    try {
      const pagesReq = fetch('/api/pages').then((r) => r.json()).then((p) => {
        setPages(p.pages || []);
        if (p.stale) fetch('/api/pages?refresh=1').then((r) => r.json()).then((f) => { if (f.pages) setPages(f.pages); }).catch(() => {});
      }).catch(() => {});
      const a = await fetch('/api/automations').then((r) => r.json());
      if (a.error === 'db_not_configured') setDbError(true);
      const list: Automation[] = a.automations || [];
      setAutos(list);
      setLoading(false);
      await pagesReq;
      Array.from(new Set(list.map((x) => x.page_id))).forEach((pid) => { fetch(`/api/pages/${pid}/subscribe`, { method: 'POST' }).catch(() => {}); });
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const toggle = async (a: Automation) => {
    const status = a.status === 'active' ? 'paused' : 'active';
    const res = await fetch(`/api/automations/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    if (res.status === 402) { const d = await res.json().catch(() => ({})); showToast(`הגעת למגבלת ${d.limit} האוטומציות הפעילות של החבילה החינמית. שדרוג בעמוד "חבילה וחיוב".`); return; }
    setAutos((prev) => prev.map((x) => (x.id === a.id ? { ...x, status } : x)));
  };
  const remove = async (a: Automation) => {
    if (!confirm(`למחוק את "${a.name}"? הפעולה אינה הפיכה.`)) return;
    await fetch(`/api/automations/${a.id}`, { method: 'DELETE' });
    setAutos((prev) => prev.filter((x) => x.id !== a.id));
    showToast('האוטומציה נמחקה');
  };

  const targets: Target[] = useMemo(() => {
    const t: Target[] = [];
    for (const p of pages) {
      t.push({ key: `fb_${p.id}`, platform: 'facebook', page_id: p.id, ig_id: null, name: p.name, picture: p.picture });
      if (p.instagram) t.push({ key: `ig_${p.instagram.id}`, platform: 'instagram', page_id: p.id, ig_id: p.instagram.id, name: p.instagram.username ? `@${p.instagram.username}` : 'Instagram', picture: p.instagram.picture });
    }
    return t;
  }, [pages]);

  const active = autos.filter((a) => a.status === 'active').length;

  return (
    <>
      {dbError && <div className="sfa-warn">מסד הנתונים עדיין לא מחובר, אי אפשר ליצור אוטומציות כרגע.</div>}

      {building ? (
        <Builder
          targets={targets}
          onCancel={() => { setBuilding(false); router.replace('/automations'); }}
          onSaved={() => { setBuilding(false); router.replace('/automations'); load(); showToast('האוטומציה נשמרה'); }}
          onError={(m) => showToast('שגיאה: ' + m)}
        />
      ) : (
        <>
          <div className="sfa-head">
            <div>
              <div className="sfa-h">האוטומציות שלך</div>
              <p>{loading ? 'טוען…' : `${active} פעילות מתוך ${autos.length}. כל אחת עונה בציבור ושולחת הודעה פרטית עם הקישור.`}</p>
            </div>
            <button type="button" className="sfa-btn sfa-btn-primary sfa-btn-lg" onClick={() => setBuilding(true)}>+ אוטומציה חדשה</button>
          </div>

          {loading ? <div className="sfa-loading"><span className="sfa-spinner" />טוען…</div> : autos.length === 0 ? (
            <div className="sfa-empty"><b>עדיין אין אוטומציות</b>צור את הראשונה: בוחרים פוסט, מילות מפתח, ומה לענות.</div>
          ) : (
            <div className="sfa-stack" style={{ gap: 12 }}>
              {autos.map((a) => {
                const st = a.stats || { triggers: 0, dms_sent: 0, replies_sent: 0, failed: 0, last_at: null };
                const last = st.last_at ? new Date(st.last_at).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;
                return (
                <div key={a.id} className={`sfa-auto${a.status === 'active' ? '' : ' paused'}`}>
                  <span className={`sfa-plat sfa-plat-lg ${a.platform === 'instagram' ? 'sfa-plat-ig' : 'sfa-plat-fb'}`}>{a.platform === 'instagram' ? '◎' : 'f'}</span>
                  <div>
                    <h3>{a.name}<span className={`sfa-tag ${a.status === 'active' ? 'sfa-tag-sent' : 'sfa-tag-unsent'}`}>{a.status === 'active' ? 'פעילה' : 'מושהית'}</span></h3>
                    <div className="meta">
                      <span>{a.page_name || a.page_id}</span>
                      <span>· {a.post_scope === 'all_posts' ? 'כל הפוסטים' : 'פוסט ספציפי'}</span>
                      {a.public_reply_enabled && <span>· תגובה ציבורית</span>}
                      {a.dm_enabled && <span>· הודעה פרטית</span>}
                      <span>· {a.match_type === 'exact' ? 'התאמה מדויקת' : 'מכיל את המילה'}</span>
                    </div>
                    <div className="kws">{a.keywords?.length ? a.keywords.map((k) => <span key={k}>{k}</span>) : <span>כל תגובה</span>}</div>
                    {a.post_scope !== 'all_posts' && (
                      <div className="post">
                        {a.post?.image ? <img src={a.post.image} alt="" /> : <span className="ph">▦</span>}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p>{a.post?.text || (a.post ? '(ללא כיתוב)' : `פוסט ${a.post_id}`)}</p>
                          <div className="meta" style={{ marginTop: 4 }}>
                            {a.post?.comments_count != null && <span>💬 {a.post.comments_count} תגובות בפוסט</span>}
                            {a.post?.like_count != null && <span>· ❤️ {a.post.like_count}</span>}
                          </div>
                        </div>
                        {a.post?.permalink && <a href={a.post.permalink} target="_blank" rel="noreferrer">צפייה בפוסט ↗</a>}
                      </div>
                    )}
                    <div className="counters">
                      <span>הופעלה <b>{st.triggers}</b> פעמים</span>
                      <span className={st.dms_sent ? 'ok' : ''}>✉️ <b>{st.dms_sent}</b> הודעות פרטיות נשלחו</span>
                      <span className={st.replies_sent ? 'ok' : ''}>💬 <b>{st.replies_sent}</b> תגובות ציבוריות</span>
                      {st.failed > 0 && <span className="bad">⚠ <b>{st.failed}</b> נכשלו</span>}
                      {last && <span>אחרונה: {last}</span>}
                    </div>
                    {editing === a.id && (
                      <Editor
                        a={a}
                        onCancel={() => setEditing(null)}
                        onSaved={(updated) => { setAutos((prev) => prev.map((x) => (x.id === a.id ? { ...x, ...updated } : x))); setEditing(null); showToast('האוטומציה עודכנה'); }}
                        onError={(m) => showToast('שגיאה: ' + m)}
                      />
                    )}
                  </div>
                  <div className="acts">
                    <button type="button" className="sfa-btn sfa-btn-cyan sfa-btn-sm" onClick={() => setEditing(editing === a.id ? null : a.id)}>{editing === a.id ? 'סגירה' : 'עריכה'}</button>
                    <button type="button" className="sfa-btn sfa-btn-ghost sfa-btn-sm" onClick={() => toggle(a)}>{a.status === 'active' ? 'השהיה' : 'הפעלה'}</button>
                    <button type="button" className="sfa-btn sfa-btn-danger sfa-btn-sm" onClick={() => remove(a)}>מחיקה</button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {toast && <div className="sfa-toast">{toast}</div>}
    </>
  );
}

function Builder({ targets, onCancel, onSaved, onError }: { targets: Target[]; onCancel: () => void; onSaved: () => void; onError: (m: string) => void }) {
  const [target, setTarget] = useState<Target | null>(null);
  const [allPosts, setAllPosts] = useState(false);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postId, setPostId] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [kwInput, setKwInput] = useState('');
  const [matchType, setMatchType] = useState<'contains' | 'exact'>('contains');
  const [replies, setReplies] = useState<string[]>(DEFAULT_REPLIES);
  const [publicOn, setPublicOn] = useState(true);
  const [dmOn, setDmOn] = useState(true);
  const [dmMessage, setDmMessage] = useState('היי {שם הפונה}! 👋\nתודה על ההתעניינות. הנה הקישור שהבטחנו:');
  const [dmLink, setDmLink] = useState('');
  const [oncePerUser, setOncePerUser] = useState(true);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target || allPosts) { setPosts([]); return; }
    (async () => {
      setLoadingPosts(true);
      try {
        const url = target.platform === 'instagram' ? `/api/pages/${target.page_id}/instagram/media?igId=${target.ig_id}` : `/api/pages/${target.page_id}/posts`;
        const data = await fetch(url).then((r) => r.json());
        setPosts(target.platform === 'instagram'
          ? (data.media || []).map((m: any) => ({ id: m.id, text: m.caption || '(ללא כיתוב)', image: m.media_url || m.thumbnail_url, likes: m.like_count, comments: m.comments_count }))
          : (data.posts || []).map((p: any) => ({ id: p.id, text: p.message || p.story || '(פוסט ללא טקסט)', image: p.full_picture, likes: p.likes?.summary?.total_count, comments: p.comments?.summary?.total_count })));
      } finally { setLoadingPosts(false); }
    })();
  }, [target, allPosts]);

  const step = !target ? 1 : !allPosts && !postId ? 2 : keywords.length === 0 ? 3 : !replies.some((r) => r.trim()) && publicOn ? 4 : dmOn && !dmLink && !dmMessage.trim() ? 5 : 6;
  const canSave = !!target && (allPosts || !!postId) && (!!name.trim() || !!target);

  const addKeyword = () => {
    const parts = kwInput.split(',').map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    setKeywords((k) => Array.from(new Set([...k, ...parts])));
    setKwInput('');
  };

  const save = async (status: 'active' | 'paused') => {
    if (!target) return;
    setSaving(true);
    try {
      await fetch(`/api/pages/${target.page_id}/subscribe`, { method: 'POST' }).catch(() => {});
      const autoName = name.trim() || (keywords.length ? `${keywords[0]} · ${target.name}` : `כל תגובה · ${target.name}`);
      const res = await fetch('/api/automations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: autoName, platform: target.platform, page_id: target.page_id, ig_id: target.ig_id,
          post_scope: allPosts ? 'all_posts' : 'specific_post', post_id: allPosts ? null : postId,
          keywords, match_type: matchType,
          public_reply_enabled: publicOn, public_replies: replies.map((r) => r.trim()).filter(Boolean),
          dm_enabled: dmOn, dm_message: dmOn ? dmMessage.trim() || null : null, dm_link: dmOn ? dmLink.trim() || null : null,
          once_per_user: oncePerUser, status,
        }),
      });
      const data = await res.json();
      if (res.status === 402 && data.error === 'plan_limit') throw new Error(`הגעת למגבלת ${data.limit} האוטומציות הפעילות של החבילה החינמית. שדרוג בעמוד "חבילה וחיוב".`);
      if (!res.ok) throw new Error(data.error || 'failed');
      onSaved();
    } catch (e: any) { onError(e.message); } finally { setSaving(false); }
  };

  const selectedPost = posts.find((p) => p.id === postId);
  const previewReply = (replies.find((r) => r.trim()) || '').replace('{שם הפונה}', 'אור').replace('{מילת המפתח}', keywords[0] || 'מחיר').replace('{שם הדף}', target?.name || '');
  const previewDm = dmMessage.replace('{שם הפונה}', 'אור').replace('{מילת המפתח}', keywords[0] || 'מחיר').replace('{שם הדף}', target?.name || '');

  return (
    <>
      <div className="sfa-head">
        <div>
          <div className="sfa-h">אוטומציה חדשה</div>
          <p>שישה שלבים קצרים. אפשר לשמור כמושהית ולהפעיל אחר כך.</p>
        </div>
        <input className="sfa-input" style={{ maxWidth: 320 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="שם לאוטומציה (לא חובה)" />
      </div>

      <div className="sfa-progress">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div key={n}><button type="button" className={n <= step ? 'done' : ''} aria-label={`שלב ${n}`}>{n}</button>{n < 6 && <i className={n < step ? 'done' : ''} />}</div>
        ))}
      </div>

      <div className="sfa-builder">
        <div className="sfa-steps">
          <section className={`sfa-step${step >= 1 ? ' active' : ''}`}>
            <div className="sfa-step-h"><div><span className="sfa-step-n">1</span>בחירת דף או חשבון</div></div>
            {targets.length === 0 ? <div className="sfa-sub">לא נמצאו דפים עם הרשאות ניהול.</div> : (
              <div className="sfa-targets">
                {targets.map((t) => (
                  <button type="button" key={t.key} className={`sfa-target${target?.key === t.key ? ' sel' : ''}`} onClick={() => { setTarget(t); setPostId(''); }}>
                    <span className={`sfa-plat sfa-plat-lg ${t.platform === 'instagram' ? 'sfa-plat-ig' : 'sfa-plat-fb'}`}>{t.platform === 'instagram' ? '◎' : 'f'}</span>
                    <div><strong style={t.platform === 'instagram' ? { direction: 'ltr', textAlign: 'right' } : undefined}>{t.name}</strong><small>{t.platform === 'instagram' ? 'אינסטגרם עסקי' : 'דף פייסבוק'}</small></div>
                    <span className="sfa-check">{target?.key === t.key ? '✓' : ''}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className={`sfa-step${step >= 2 ? ' active' : ''}`}>
            <div className="sfa-step-h">
              <div><span className="sfa-step-n">2</span>בחירת פוסט</div>
              <button type="button" className={`sfa-pill-btn${allPosts ? ' on' : ''}`} onClick={() => { setAllPosts((v) => !v); setPostId(''); }} disabled={!target}>כל הפוסטים בחשבון</button>
            </div>
            {!target ? <div className="sfa-sub">בחר קודם דף או חשבון.</div> : allPosts ? <div className="sfa-sub">האוטומציה תפעל על כל פוסט בחשבון, כולל פוסטים עתידיים.</div> : loadingPosts ? <div className="sfa-loading"><span className="sfa-spinner" />טוען פוסטים…</div> : posts.length === 0 ? (
              <input className="sfa-input" dir="ltr" value={postId} onChange={(e) => setPostId(e.target.value)} placeholder="לא נמצאו פוסטים. אפשר להדביק מזהה פוסט ידנית" />
            ) : (
              <div className="sfa-posts">
                {posts.map((p) => (
                  <button type="button" key={p.id} className={`sfa-post${postId === p.id ? ' sel' : ''}`} onClick={() => setPostId(p.id)} title={p.text}>
                    {p.image ? <img src={p.image} alt="" /> : <span className="ph">▦</span>}
                    <div><strong>{p.text}</strong><small>{p.comments != null ? `${p.comments} תגובות` : ''}</small></div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className={`sfa-step${step >= 3 ? ' active' : ''}`}>
            <div className="sfa-step-h"><div><span className="sfa-step-n">3</span>מילות מפתח</div>
              <select className="sfa-select" style={{ width: 'auto' }} value={matchType} onChange={(e) => setMatchType(e.target.value as any)}>
                <option value="contains">התגובה מכילה את המילה</option><option value="exact">התגובה זהה למילה</option>
              </select>
            </div>
            <div className="sfa-sub">האוטומציה תופעל כשתגובה מכילה אחת מהמילים. בלי מילים, כל תגובה תופעל.</div>
            <div className="sfa-chips">
              {keywords.map((k, i) => <span key={k} className="sfa-chip">{k}<button type="button" onClick={() => setKeywords((ks) => ks.filter((_, j) => j !== i))} aria-label={`הסר ${k}`}>✕</button></span>)}
              <span className="sfa-chip-add">
                <input value={kwInput} onChange={(e) => setKwInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }} placeholder="+ הוסף מילה" />
                {kwInput && <button type="button" className="sfa-btn sfa-btn-cyan sfa-btn-sm" style={{ padding: '4px 10px' }} onClick={addKeyword}>הוסף</button>}
              </span>
            </div>
          </section>

          <section className={`sfa-step${step >= 4 ? ' active' : ''}`}>
            <div className="sfa-step-h"><div><span className="sfa-step-n">4</span>תגובות ציבוריות</div>
              <button type="button" className={`sfa-toggle${publicOn ? ' on' : ''}`} onClick={() => setPublicOn((v) => !v)} aria-label="תגובה ציבורית"><span /></button>
            </div>
            {publicOn ? (
              <>
                <div className="sfa-sub">המערכת מסובבת בין הנוסחים כדי שהתגובות לא ייראו זהות.</div>
                <div className="sfa-stack">
                  {replies.map((r, i) => (
                    <div key={i} className="sfa-reply"><b>{i + 1}</b><input value={r} onChange={(e) => setReplies((rs) => rs.map((x, j) => (j === i ? e.target.value : x)))} placeholder="נוסח תגובה" />{replies.length > 1 && <button type="button" onClick={() => setReplies((rs) => rs.filter((_, j) => j !== i))} aria-label="הסר נוסח">✕</button>}</div>
                  ))}
                  <button type="button" className="sfa-btn sfa-btn-dashed sfa-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setReplies((rs) => [...rs, ''])}>+ הוסף נוסח</button>
                </div>
              </>
            ) : <div className="sfa-sub">לא תישלח תגובה ציבורית, רק הודעה פרטית.</div>}
          </section>

          <section className={`sfa-step${step >= 5 ? ' active' : ''}`}>
            <div className="sfa-step-h"><div><span className="sfa-step-n">5</span>ההודעה הפרטית</div>
              <button type="button" className={`sfa-toggle${dmOn ? ' on' : ''}`} onClick={() => setDmOn((v) => !v)} aria-label="הודעה פרטית"><span /></button>
            </div>
            {dmOn ? (
              <>
                <textarea className="sfa-textarea" value={dmMessage} onChange={(e) => setDmMessage(e.target.value)} placeholder="היי! הנה הקישור שביקשת:" />
                <div className="sfa-vars">{VARS.map((v) => <button type="button" key={v} onClick={() => setDmMessage((m) => (m ? m + ' ' : '') + v)}>{v}</button>)}</div>
                <label className="sfa-label" style={{ marginTop: 14 }}>קישור שיצורף להודעה</label>
                <input className="sfa-input" dir="ltr" value={dmLink} onChange={(e) => setDmLink(e.target.value)} placeholder="https://" />
              </>
            ) : <div className="sfa-sub">לא תישלח הודעה פרטית.</div>}
          </section>

          <section className={`sfa-step${step >= 6 ? ' active' : ''}`}>
            <div className="sfa-step-h"><div><span className="sfa-step-n">6</span>הגדרות נוספות</div></div>
            <div className="sfa-stack" style={{ gap: 12 }}>
              <div className="sfa-setting"><div><strong>פעם אחת לכל מגיב</strong><small>הודעה פרטית אחת בלבד לכל אדם, גם אם הגיב כמה פעמים.</small></div><button type="button" className={`sfa-toggle${oncePerUser ? ' on' : ''}`} onClick={() => setOncePerUser((v) => !v)} aria-label="פעם אחת לכל מגיב"><span /></button></div>
              <div className="sfa-setting"><div><strong>לא לענות לתגובות שקדמו לאוטומציה</strong><small>תמיד פעיל: האוטומציה מטפלת רק בתגובות שנכתבו מרגע ההפעלה.</small></div><button type="button" className="sfa-toggle on" disabled aria-label="תמיד פעיל"><span /></button></div>
            </div>
          </section>
        </div>

        <aside className="sfa-preview" aria-label="תצוגה מקדימה של התהליך">
          <div className="sfa-eyebrow">תצוגה מקדימה של התהליך</div>
          <div className="sfa-msg"><span className={`sfa-av ${target?.platform === 'instagram' ? 'sfa-av-ig' : 'sfa-av-fb'}`}>{target?.platform === 'instagram' ? '' : 'f'}</span><div className="sfa-bubble sfa-bubble-user"><small>תגובה בפוסט{selectedPost ? `: ${selectedPost.text.slice(0, 30)}` : ''}</small>{keywords[0] ? `מעניין, ${keywords[0]}?` : 'מעניין, כמה זה עולה?'}</div></div>
          {publicOn && <div className="sfa-msg"><span className="sfa-av sfa-av-sf" /><div className="sfa-bubble sfa-bubble-public"><small>תגובה ציבורית</small>{previewReply || 'נוסח התגובה יופיע כאן'}</div></div>}
          {dmOn && <div className="sfa-msg"><span className="sfa-av sfa-av-ig" /><div className="sfa-bubble sfa-bubble-dm"><small>הודעה פרטית</small><span style={{ whiteSpace: 'pre-wrap' }}>{previewDm || 'תוכן ההודעה יופיע כאן'}</span>{dmLink && <><br /><a href={dmLink} target="_blank" rel="noreferrer" style={{ direction: 'ltr', display: 'inline-block' }}>{dmLink}</a></>}</div></div>}
          <div className="sfa-lead-in"><i>✓</i><div><strong>ליד נקלט</strong><small>נשמר ביומן עם מילת המפתח ושעת הפנייה.</small></div></div>
        </aside>
      </div>

      <div className="sfa-sticky-bar">
        <div className="sfa-sub"><span className="sfa-dot" />שלב {step} מתוך 6 · {keywords.length} מילות מפתח · {replies.filter((r) => r.trim()).length} נוסחי תגובה</div>
        <div className="sfa-spacer" />
        <div className="sfa-actions">
          <button type="button" className="sfa-btn sfa-btn-ghost" onClick={onCancel} disabled={saving}>ביטול</button>
          <button type="button" className="sfa-btn sfa-btn-vi" onClick={() => save('paused')} disabled={!canSave || saving}>שמירה כמושהית</button>
          <button type="button" className="sfa-btn sfa-btn-primary" onClick={() => save('active')} disabled={!canSave || saving}>{saving ? 'שומר…' : 'הפעלה ▸'}</button>
        </div>
      </div>
    </>
  );
}


/** Inline editor for an existing automation (everything except the target post). */
function Editor({ a, onCancel, onSaved, onError }: { a: Automation; onCancel: () => void; onSaved: (u: Partial<Automation>) => void; onError: (m: string) => void }) {
  const [name, setName] = useState(a.name);
  const [keywords, setKeywords] = useState<string[]>(a.keywords || []);
  const [kwInput, setKwInput] = useState('');
  const [matchType, setMatchType] = useState<'contains' | 'exact'>((a.match_type as any) || 'contains');
  const [publicOn, setPublicOn] = useState(a.public_reply_enabled);
  const [replies, setReplies] = useState<string[]>(a.public_replies?.length ? a.public_replies : ['']);
  const [dmOn, setDmOn] = useState(a.dm_enabled);
  const [dmMessage, setDmMessage] = useState(a.dm_message || '');
  const [dmLink, setDmLink] = useState(a.dm_link || '');
  const [oncePerUser, setOncePerUser] = useState(a.once_per_user);
  const [saving, setSaving] = useState(false);

  const addKeyword = () => {
    const parts = kwInput.split(',').map((x) => x.trim()).filter(Boolean);
    if (!parts.length) return;
    setKeywords((k) => Array.from(new Set([...k, ...parts])));
    setKwInput('');
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        name: name.trim() || a.name, keywords, match_type: matchType,
        public_reply_enabled: publicOn, public_replies: replies.map((r) => r.trim()).filter(Boolean),
        dm_enabled: dmOn, dm_message: dmOn ? dmMessage.trim() || null : null, dm_link: dmOn ? dmLink.trim() || null : null,
        once_per_user: oncePerUser,
      };
      const res = await fetch(`/api/automations/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed');
      onSaved(data.automation || body);
    } catch (e: any) { onError(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="sfa-editor" onClick={(e) => e.stopPropagation()}>
      <div className="row">
        <div>
          <label className="sfa-label">שם האוטומציה</label>
          <input className="sfa-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="sfa-label">סוג התאמה</label>
          <select className="sfa-select" value={matchType} onChange={(e) => setMatchType(e.target.value as any)}>
            <option value="contains">התגובה מכילה את המילה</option><option value="exact">התגובה זהה למילה</option>
          </select>
        </div>
      </div>
      <div>
        <label className="sfa-label">מילות מפתח (ריק = כל תגובה)</label>
        <div className="sfa-chips">
          {keywords.map((k, i) => <span key={k} className="sfa-chip">{k}<button type="button" onClick={() => setKeywords((ks) => ks.filter((_, j) => j !== i))} aria-label={`הסר ${k}`}>✕</button></span>)}
          <span className="sfa-chip-add">
            <input value={kwInput} onChange={(e) => setKwInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }} placeholder="+ הוסף מילה" />
            {kwInput && <button type="button" className="sfa-btn sfa-btn-cyan sfa-btn-sm" style={{ padding: '4px 10px' }} onClick={addKeyword}>הוסף</button>}
          </span>
        </div>
      </div>
      <div>
        <div className="sfa-step-h" style={{ marginBottom: 6 }}><div>תגובות ציבוריות</div><button type="button" className={`sfa-toggle${publicOn ? ' on' : ''}`} onClick={() => setPublicOn((v) => !v)} aria-label="תגובה ציבורית"><span /></button></div>
        {publicOn && (
          <div className="sfa-stack">
            {replies.map((r, i) => (
              <div key={i} className="sfa-reply"><b>{i + 1}</b><input value={r} onChange={(e) => setReplies((rs) => rs.map((x, j) => (j === i ? e.target.value : x)))} placeholder="נוסח תגובה" />{replies.length > 1 && <button type="button" onClick={() => setReplies((rs) => rs.filter((_, j) => j !== i))} aria-label="הסר נוסח">✕</button>}</div>
            ))}
            <button type="button" className="sfa-btn sfa-btn-dashed sfa-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setReplies((rs) => [...rs, ''])}>+ הוסף נוסח</button>
          </div>
        )}
      </div>
      <div>
        <div className="sfa-step-h" style={{ marginBottom: 6 }}><div>ההודעה הפרטית</div><button type="button" className={`sfa-toggle${dmOn ? ' on' : ''}`} onClick={() => setDmOn((v) => !v)} aria-label="הודעה פרטית"><span /></button></div>
        {dmOn && (
          <>
            <textarea className="sfa-textarea" value={dmMessage} onChange={(e) => setDmMessage(e.target.value)} placeholder="היי! הנה הקישור שביקשת:" />
            <div className="sfa-vars">{VARS.map((v) => <button type="button" key={v} onClick={() => setDmMessage((m) => (m ? m + ' ' : '') + v)}>{v}</button>)}</div>
            <label className="sfa-label" style={{ marginTop: 10 }}>קישור שיצורף להודעה</label>
            <input className="sfa-input" dir="ltr" value={dmLink} onChange={(e) => setDmLink(e.target.value)} placeholder="https://" />
          </>
        )}
      </div>
      <div className="sfa-setting"><div><strong>פעם אחת לכל מגיב</strong><small>הודעה פרטית אחת בלבד לכל אדם.</small></div><button type="button" className={`sfa-toggle${oncePerUser ? ' on' : ''}`} onClick={() => setOncePerUser((v) => !v)} aria-label="פעם אחת לכל מגיב"><span /></button></div>
      <div className="foot">
        <button type="button" className="sfa-btn sfa-btn-primary" onClick={save} disabled={saving}>{saving ? 'שומר…' : 'שמירת שינויים'}</button>
        <button type="button" className="sfa-btn sfa-btn-ghost" onClick={onCancel} disabled={saving}>ביטול</button>
      </div>
    </div>
  );
}
