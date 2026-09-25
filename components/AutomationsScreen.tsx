'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useI18n } from './I18nProvider';

/** Automations list + the six-step builder + inline editor. API: /api/automations, /api/pages, posts and media endpoints. */

interface Page { id: string; name: string; picture?: string; instagram?: { id: string; username?: string; picture?: string } | null }
interface Stats { triggers: number; dms_sent: number; replies_sent: number; failed: number; last_at: string | null }
interface PostInfo { id: string; permalink?: string; comments_count?: number | null; like_count?: number | null; text?: string; image?: string }
interface Automation { id: string; name: string; platform: string; page_id: string; page_name?: string; post_id?: string; post_scope: string; keywords: string[]; match_type: string; public_reply_enabled: boolean; public_replies: string[]; dm_enabled: boolean; dm_message?: string; dm_link?: string; once_per_user: boolean; status: string; trigger_count: number; created_at: string; stats?: Stats; post?: PostInfo | null }
interface Target { key: string; platform: 'facebook' | 'instagram'; page_id: string; ig_id: string | null; name: string; picture?: string }
interface PostItem { id: string; text: string; image?: string; likes?: number | null; comments?: number | null }

export default function AutomationsScreen() {
  const { m, t, p, dateTime } = useI18n();
  const A = m.automations;
  const router = useRouter();
  const params = useSearchParams();
  const [pages, setPages] = useState<Page[]>([]);
  const [autos, setAutos] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [building, setBuilding] = useState(params?.get('new') === '1');
  const [editing, setEditing] = useState<string | null>(null);

  const showToast = (x: string) => { setToast(x); setTimeout(() => setToast(null), 3000); };

  const load = async () => {
    setLoading(true);
    try {
      const pagesReq = fetch('/api/pages').then((r) => r.json()).then((pg) => {
        setPages(pg.pages || []);
        if (pg.stale) fetch('/api/pages?refresh=1').then((r) => r.json()).then((f) => { if (f.pages) setPages(f.pages); }).catch(() => {});
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
    if (res.status === 402) { const d = await res.json().catch(() => ({})); showToast(t(d.reason === 'accounts' ? A.accountLimit : A.planLimit, { limit: d.limit })); return; }
    setAutos((prev) => prev.map((x) => (x.id === a.id ? { ...x, status } : x)));
  };
  const remove = async (a: Automation) => {
    if (!confirm(t(A.deleteConfirm, { name: a.name }))) return;
    await fetch(`/api/automations/${a.id}`, { method: 'DELETE' });
    setAutos((prev) => prev.filter((x) => x.id !== a.id));
    showToast(A.deleted);
  };

  const targets: Target[] = useMemo(() => {
    const out: Target[] = [];
    for (const pg of pages) {
      out.push({ key: `fb_${pg.id}`, platform: 'facebook', page_id: pg.id, ig_id: null, name: pg.name, picture: pg.picture });
      if (pg.instagram) out.push({ key: `ig_${pg.instagram.id}`, platform: 'instagram', page_id: pg.id, ig_id: pg.instagram.id, name: pg.instagram.username ? `@${pg.instagram.username}` : 'Instagram', picture: pg.instagram.picture });
    }
    return out;
  }, [pages]);

  const active = autos.filter((a) => a.status === 'active').length;

  return (
    <>
      {dbError && <div className="sfa-warn">{A.dbMissing}</div>}

      {building ? (
        <Builder targets={targets}
          onCancel={() => { setBuilding(false); router.replace(p('/automations')); }}
          onSaved={() => { setBuilding(false); router.replace(p('/automations')); load(); showToast(A.saved); }}
          onError={(x) => showToast(`${m.common.error}: ${x}`)} />
      ) : (
        <>
          <div className="sfa-head">
            <div>
              <div className="sfa-h">{A.title}</div>
              <p>{loading ? m.common.loading : t(A.summary, { active, total: autos.length })}</p>
            </div>
            <button type="button" className="sfa-btn sfa-btn-primary sfa-btn-lg" onClick={() => setBuilding(true)}>{A.newAutomation}</button>
          </div>

          {loading ? <div className="sfa-loading"><span className="sfa-spinner" />{m.common.loading}</div> : autos.length === 0 ? (
            <div className="sfa-empty"><b>{A.emptyTitle}</b>{A.emptyText}</div>
          ) : (
            <div className="sfa-stack" style={{ gap: 12 }}>
              {autos.map((a) => {
                const st = a.stats || { triggers: 0, dms_sent: 0, replies_sent: 0, failed: 0, last_at: null };
                const last = st.last_at ? dateTime(st.last_at) : null;
                return (
                <div key={a.id} className={`sfa-auto${a.status === 'active' ? '' : ' paused'}`}>
                  <span className={`sfa-plat sfa-plat-lg ${a.platform === 'instagram' ? 'sfa-plat-ig' : 'sfa-plat-fb'}`}>{a.platform === 'instagram' ? '◎' : 'f'}</span>
                  <div>
                    <h3>{a.name}<span className={`sfa-tag ${a.status === 'active' ? 'sfa-tag-sent' : 'sfa-tag-unsent'}`}>{a.status === 'active' ? m.common.active : m.common.paused}</span></h3>
                    <div className="meta">
                      <span>{a.page_name || a.page_id}</span>
                      <span>· {a.post_scope === 'story_replies' ? A.storyReplies : a.post_scope === 'all_posts' ? A.allPosts : A.specificPost}</span>
                      {a.public_reply_enabled && <span>· {A.publicReply}</span>}
                      {a.dm_enabled && <span>· {A.privateMessage}</span>}
                      <span>· {a.match_type === 'exact' ? A.exactMatch : A.containsMatch}</span>
                    </div>
                    <div className="kws">{a.keywords?.length ? a.keywords.map((k) => <span key={k}>{k}</span>) : <span>{a.post_scope === 'story_replies' ? A.storyReplies : m.common.anyComment}</span>}</div>
                    {a.post_scope === 'specific_post' && (
                      <div className="post">
                        {a.post?.image ? <img src={a.post.image} alt="" /> : <span className="ph">▦</span>}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p>{a.post?.text || (a.post ? A.noCaption : t(A.postId, { id: a.post_id || '' }))}</p>
                          <div className="meta" style={{ marginTop: 4 }}>
                            {a.post?.comments_count != null && <span>💬 {t(A.commentsOnPost, { n: a.post.comments_count })}</span>}
                            {a.post?.like_count != null && <span>· ❤️ {a.post.like_count}</span>}
                          </div>
                        </div>
                        {a.post?.permalink && <a href={a.post.permalink} target="_blank" rel="noreferrer">{A.viewPost}</a>}
                      </div>
                    )}
                    <div className="counters">
                      <span>{t(A.triggered, { n: st.triggers })}</span>
                      <span className={st.dms_sent ? 'ok' : ''}>✉️ {t(A.dmsSent, { n: st.dms_sent })}</span>
                      <span className={st.replies_sent ? 'ok' : ''}>💬 {t(A.repliesSent, { n: st.replies_sent })}</span>
                      {st.failed > 0 && <span className="bad">⚠ {t(A.failed, { n: st.failed })}</span>}
                      {last && <span>{t(A.last, { when: last })}</span>}
                    </div>
                    {editing === a.id && (
                      <Editor a={a} onCancel={() => setEditing(null)}
                        onSaved={(updated) => { setAutos((prev) => prev.map((x) => (x.id === a.id ? { ...x, ...updated } : x))); setEditing(null); showToast(A.updated); }}
                        onError={(x) => showToast(`${m.common.error}: ${x}`)} />
                    )}
                  </div>
                  <div className="acts">
                    <button type="button" className="sfa-btn sfa-btn-cyan sfa-btn-sm" onClick={() => setEditing(editing === a.id ? null : a.id)}>{editing === a.id ? m.common.close : m.common.edit}</button>
                    <button type="button" className="sfa-btn sfa-btn-ghost sfa-btn-sm" onClick={() => toggle(a)}>{a.status === 'active' ? m.common.pause : m.common.resume}</button>
                    <button type="button" className="sfa-btn sfa-btn-danger sfa-btn-sm" onClick={() => remove(a)}>{m.common.delete}</button>
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

function KeywordChips({ keywords, setKeywords }: { keywords: string[]; setKeywords: (f: (k: string[]) => string[]) => void }) {
  const { m, t } = useI18n(); const A = m.automations;
  const [kwInput, setKwInput] = useState('');
  const addKeyword = () => {
    const parts = kwInput.split(',').map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    setKeywords((k) => Array.from(new Set([...k, ...parts])));
    setKwInput('');
  };
  return (
    <div className="sfa-chips">
      {keywords.map((k, i) => <span key={k} className="sfa-chip">{k}<button type="button" onClick={() => setKeywords((ks) => ks.filter((_, j) => j !== i))} aria-label={t(A.removeWord, { word: k })}>✕</button></span>)}
      <span className="sfa-chip-add">
        <input value={kwInput} onChange={(e) => setKwInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }} placeholder={A.addWord} />
        {kwInput && <button type="button" className="sfa-btn sfa-btn-cyan sfa-btn-sm" style={{ padding: '4px 10px' }} onClick={addKeyword}>{A.add}</button>}
      </span>
    </div>
  );
}

function Builder({ targets, onCancel, onSaved, onError }: { targets: Target[]; onCancel: () => void; onSaved: () => void; onError: (x: string) => void }) {
  const { m, t } = useI18n(); const A = m.automations;
  const VARS = [A.varName, A.varKeyword, A.varPage];
  const [target, setTarget] = useState<Target | null>(null);
  const [scope, setScope] = useState<'specific_post' | 'all_posts' | 'story_replies'>('specific_post');
  const allPosts = scope === 'all_posts';
  const story = scope === 'story_replies';
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postId, setPostId] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [matchType, setMatchType] = useState<'contains' | 'exact'>('contains');
  const [replies, setReplies] = useState<string[]>([A.defaultReply]);
  const [publicOn, setPublicOn] = useState(true);
  const [dmOn, setDmOn] = useState(true);
  const [dmMessage, setDmMessage] = useState(A.defaultDm.replace('{name}', A.varName));
  const [dmLink, setDmLink] = useState('');
  const [oncePerUser, setOncePerUser] = useState(true);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target || scope !== 'specific_post') { setPosts([]); return; }
    (async () => {
      setLoadingPosts(true);
      try {
        const url = target.platform === 'instagram' ? `/api/pages/${target.page_id}/instagram/media?igId=${target.ig_id}` : `/api/pages/${target.page_id}/posts`;
        const data = await fetch(url).then((r) => r.json());
        setPosts(target.platform === 'instagram'
          ? (data.media || []).map((x: any) => ({ id: x.id, text: x.caption || A.noCaption, image: x.media_url || x.thumbnail_url, likes: x.like_count, comments: x.comments_count }))
          : (data.posts || []).map((x: any) => ({ id: x.id, text: x.message || x.story || m.posts.noText, image: x.full_picture, likes: x.likes?.summary?.total_count, comments: x.comments?.summary?.total_count })));
      } finally { setLoadingPosts(false); }
    })();
  }, [target, scope]); // eslint-disable-line react-hooks/exhaustive-deps

  // Story replies arrive as DMs: no public reply, and the private message is the whole point.
  const publicActive = publicOn && !story;
  const dmActive = dmOn || story;
  const step = !target ? 1 : scope === 'specific_post' && !postId ? 2 : keywords.length === 0 ? 3 : !replies.some((r) => r.trim()) && publicActive ? 4 : dmActive && !dmLink && !dmMessage.trim() ? 5 : 6;
  const canSave = !!target && (scope !== 'specific_post' || !!postId) && (!story || !!dmMessage.trim());

  const save = async (status: 'active' | 'paused') => {
    if (!target) return;
    setSaving(true);
    try {
      await fetch(`/api/pages/${target.page_id}/subscribe`, { method: 'POST' }).catch(() => {});
      const autoName = name.trim() || (keywords.length ? `${keywords[0]} · ${target.name}` : `${story ? A.storyReplies : m.common.anyComment} · ${target.name}`);
      const res = await fetch('/api/automations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: autoName, platform: target.platform, page_id: target.page_id, ig_id: target.ig_id,
          post_scope: scope, post_id: scope === 'specific_post' ? postId : null,
          keywords, match_type: matchType,
          public_reply_enabled: publicActive, public_replies: publicActive ? replies.map((r) => r.trim()).filter(Boolean) : [],
          dm_enabled: dmActive, dm_message: dmActive ? dmMessage.trim() || null : null, dm_link: dmActive ? dmLink.trim() || null : null,
          once_per_user: oncePerUser, status,
        }),
      });
      const data = await res.json();
      if (res.status === 402 && data.error === 'plan_limit') throw new Error(t(data.reason === 'accounts' ? A.accountLimit : A.planLimit, { limit: data.limit }));
      if (!res.ok) throw new Error(data.error || 'failed');
      onSaved();
    } catch (e: any) { onError(e.message); } finally { setSaving(false); }
  };

  const selectedPost = posts.find((x) => x.id === postId);
  const sub = (s: string) => s.replace(A.varName, A.previewName).replace(A.varKeyword, keywords[0] || A.previewDefaultKw).replace(A.varPage, target?.name || '');
  const previewReply = sub(replies.find((r) => r.trim()) || '');
  const previewDm = sub(dmMessage);

  return (
    <>
      <div className="sfa-head">
        <div><div className="sfa-h">{A.builderTitle}</div><p>{A.builderSub}</p></div>
        <input className="sfa-input" style={{ maxWidth: 320 }} value={name} onChange={(e) => setName(e.target.value)} placeholder={A.namePlaceholder} />
      </div>

      <div className="sfa-progress">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div key={n}><button type="button" className={n <= step ? 'done' : ''} aria-label={t(A.stepLabel, { n })}>{n}</button>{n < 6 && <i className={n < step ? 'done' : ''} />}</div>
        ))}
      </div>

      <div className="sfa-builder">
        <div className="sfa-steps">
          <section className={`sfa-step${step >= 1 ? ' active' : ''}`}>
            <div className="sfa-step-h"><div><span className="sfa-step-n">1</span>{A.step1}</div></div>
            {targets.length === 0 ? <div className="sfa-sub">{A.noTargets}</div> : (
              <div className="sfa-targets">
                {targets.map((x) => (
                  <button type="button" key={x.key} className={`sfa-target${target?.key === x.key ? ' sel' : ''}`} onClick={() => { setTarget(x); setPostId(''); if (x.platform !== 'instagram' && scope === 'story_replies') setScope('specific_post'); }}>
                    <span className={`sfa-plat sfa-plat-lg ${x.platform === 'instagram' ? 'sfa-plat-ig' : 'sfa-plat-fb'}`}>{x.platform === 'instagram' ? '◎' : 'f'}</span>
                    <div><strong style={x.platform === 'instagram' ? { direction: 'ltr', textAlign: 'start' } : undefined}>{x.name}</strong><small>{x.platform === 'instagram' ? m.common.instagramBusiness : m.common.facebookPage}</small></div>
                    <span className="sfa-check">{target?.key === x.key ? '✓' : ''}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className={`sfa-step${step >= 2 ? ' active' : ''}`}>
            <div className="sfa-step-h">
              <div><span className="sfa-step-n">2</span>{A.step2}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className={`sfa-pill-btn${allPosts ? ' on' : ''}`} onClick={() => { setScope(allPosts ? 'specific_post' : 'all_posts'); setPostId(''); }} disabled={!target}>{A.allPostsBtn}</button>
                {target?.platform === 'instagram' && (
                  <button type="button" className={`sfa-pill-btn${story ? ' on' : ''}`} onClick={() => { setScope(story ? 'specific_post' : 'story_replies'); setPostId(''); }}>{A.storyRepliesBtn}</button>
                )}
              </div>
            </div>
            {!target ? <div className="sfa-sub">{A.chooseTargetFirst}</div> : story ? <div className="sfa-sub">{A.storyRepliesNote}</div> : allPosts ? <div className="sfa-sub">{A.allPostsNote}</div> : loadingPosts ? <div className="sfa-loading"><span className="sfa-spinner" />{A.loadingPosts}</div> : posts.length === 0 ? (
              <input className="sfa-input" dir="ltr" value={postId} onChange={(e) => setPostId(e.target.value)} placeholder={A.pastePostId} />
            ) : (
              <div className="sfa-posts">
                {posts.map((x) => (
                  <button type="button" key={x.id} className={`sfa-post${postId === x.id ? ' sel' : ''}`} onClick={() => setPostId(x.id)} title={x.text}>
                    {x.image ? <img src={x.image} alt="" /> : <span className="ph">▦</span>}
                    <div><strong>{x.text}</strong><small>{x.comments != null ? t(A.postComments, { n: x.comments }) : ''}</small></div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className={`sfa-step${step >= 3 ? ' active' : ''}`}>
            <div className="sfa-step-h"><div><span className="sfa-step-n">3</span>{A.step3}</div>
              <select className="sfa-select" style={{ width: 'auto' }} value={matchType} onChange={(e) => setMatchType(e.target.value as any)}>
                <option value="contains">{A.matchContains}</option><option value="exact">{A.matchExact}</option>
              </select>
            </div>
            <div className="sfa-sub">{story ? A.storyKeywordsNote : A.keywordsNote}</div>
            <KeywordChips keywords={keywords} setKeywords={setKeywords} />
          </section>

          <section className={`sfa-step${step >= 4 ? ' active' : ''}`}>
            <div className="sfa-step-h"><div><span className="sfa-step-n">4</span>{A.step4}</div>
              {!story && <button type="button" className={`sfa-toggle${publicOn ? ' on' : ''}`} onClick={() => setPublicOn((v) => !v)} aria-label={A.publicReplyAria}><span /></button>}
            </div>
            {story ? <div className="sfa-sub">{A.storyNoPublicReply}</div> : publicOn ? (
              <>
                <div className="sfa-sub">{A.rotateNote}</div>
                <div className="sfa-stack">
                  {replies.map((r, i) => (
                    <div key={i} className="sfa-reply"><b>{i + 1}</b><input value={r} onChange={(e) => setReplies((rs) => rs.map((x, j) => (j === i ? e.target.value : x)))} placeholder={A.replyPlaceholder} />{replies.length > 1 && <button type="button" onClick={() => setReplies((rs) => rs.filter((_, j) => j !== i))} aria-label={A.removeVariant}>✕</button>}</div>
                  ))}
                  <button type="button" className="sfa-btn sfa-btn-dashed sfa-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setReplies((rs) => [...rs, ''])}>{A.addVariant}</button>
                </div>
              </>
            ) : <div className="sfa-sub">{A.noPublicReply}</div>}
          </section>

          <section className={`sfa-step${step >= 5 ? ' active' : ''}`}>
            <div className="sfa-step-h"><div><span className="sfa-step-n">5</span>{A.step5}</div>
              {!story && <button type="button" className={`sfa-toggle${dmOn ? ' on' : ''}`} onClick={() => setDmOn((v) => !v)} aria-label={A.dmAria}><span /></button>}
            </div>
            {dmActive ? (
              <>
                {story && !dmMessage.trim() && <div className="sfa-sub">{A.storyDmRequired}</div>}
                <textarea className="sfa-textarea" value={dmMessage} onChange={(e) => setDmMessage(e.target.value)} placeholder={A.dmPlaceholder} />
                <div className="sfa-vars">{VARS.map((v) => <button type="button" key={v} onClick={() => setDmMessage((x) => (x ? x + ' ' : '') + v)}>{v}</button>)}</div>
                <label className="sfa-label" style={{ marginTop: 14 }}>{A.dmLinkLabel}</label>
                <input className="sfa-input" dir="ltr" value={dmLink} onChange={(e) => setDmLink(e.target.value)} placeholder="https://" />
              </>
            ) : <div className="sfa-sub">{A.noDm}</div>}
          </section>

          <section className={`sfa-step${step >= 6 ? ' active' : ''}`}>
            <div className="sfa-step-h"><div><span className="sfa-step-n">6</span>{A.step6}</div></div>
            <div className="sfa-stack" style={{ gap: 12 }}>
              <div className="sfa-setting"><div><strong>{A.oncePerUser}</strong><small>{A.oncePerUserNote}</small></div><button type="button" className={`sfa-toggle${oncePerUser ? ' on' : ''}`} onClick={() => setOncePerUser((v) => !v)} aria-label={A.oncePerUser}><span /></button></div>
              <div className="sfa-setting"><div><strong>{story ? A.storyNoOld : A.noOldComments}</strong><small>{story ? A.storyNoOldNote : A.noOldCommentsNote}</small></div><button type="button" className="sfa-toggle on" disabled aria-label={A.alwaysOn}><span /></button></div>
            </div>
          </section>
        </div>

        <aside className="sfa-preview" aria-label={A.previewTitle}>
          <div className="sfa-eyebrow">{A.previewTitle}</div>
          <div className="sfa-msg"><span className={`sfa-av ${target?.platform === 'instagram' ? 'sfa-av-ig' : 'sfa-av-fb'}`}>{target?.platform === 'instagram' ? '' : 'f'}</span><div className="sfa-bubble sfa-bubble-user"><small>{story ? A.previewStoryReply : `${A.previewComment}${selectedPost ? `: ${selectedPost.text.slice(0, 30)}` : ''}`}</small>{t(A.previewCommentSample, { kw: keywords[0] || A.previewDefaultKw })}</div></div>
          {publicActive && <div className="sfa-msg"><span className="sfa-av sfa-av-sf" /><div className="sfa-bubble sfa-bubble-public"><small>{A.publicReply}</small>{previewReply || A.previewReplyEmpty}</div></div>}
          {dmActive && <div className="sfa-msg"><span className="sfa-av sfa-av-ig" /><div className="sfa-bubble sfa-bubble-dm"><small>{A.privateMessage}</small><span style={{ whiteSpace: 'pre-wrap' }}>{previewDm || A.previewDmEmpty}</span>{dmLink && <><br /><a href={dmLink} target="_blank" rel="noreferrer" style={{ direction: 'ltr', display: 'inline-block' }}>{dmLink}</a></>}</div></div>}
          <div className="sfa-lead-in"><i>✓</i><div><strong>{A.previewLead}</strong><small>{A.previewLeadText}</small></div></div>
        </aside>
      </div>

      <div className="sfa-sticky-bar">
        <div className="sfa-sub"><span className="sfa-dot" />{t(A.stickyStatus, { step, kw: keywords.length, replies: replies.filter((r) => r.trim()).length })}</div>
        <div className="sfa-spacer" />
        <div className="sfa-actions">
          <button type="button" className="sfa-btn sfa-btn-ghost" onClick={onCancel} disabled={saving}>{m.common.cancel}</button>
          <button type="button" className="sfa-btn sfa-btn-vi" onClick={() => save('paused')} disabled={!canSave || saving}>{A.saveAsPaused}</button>
          <button type="button" className="sfa-btn sfa-btn-primary" onClick={() => save('active')} disabled={!canSave || saving}>{saving ? A.saving : A.activate}</button>
        </div>
      </div>
    </>
  );
}

/** Inline editor for an existing automation (everything except the target post). */
function Editor({ a, onCancel, onSaved, onError }: { a: Automation; onCancel: () => void; onSaved: (u: Partial<Automation>) => void; onError: (x: string) => void }) {
  const { m } = useI18n(); const A = m.automations;
  const VARS = [A.varName, A.varKeyword, A.varPage];
  const [name, setName] = useState(a.name);
  const [keywords, setKeywords] = useState<string[]>(a.keywords || []);
  const [matchType, setMatchType] = useState<'contains' | 'exact'>((a.match_type as any) || 'contains');
  const story = a.post_scope === 'story_replies';
  const [publicOn, setPublicOn] = useState(a.public_reply_enabled && !story);
  const [replies, setReplies] = useState<string[]>(a.public_replies?.length ? a.public_replies : ['']);
  const [dmOn, setDmOn] = useState(a.dm_enabled || story);
  const [dmMessage, setDmMessage] = useState(a.dm_message || '');
  const [dmLink, setDmLink] = useState(a.dm_link || '');
  const [oncePerUser, setOncePerUser] = useState(a.once_per_user);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (story && !dmMessage.trim()) { onError(A.storyDmRequired); return; }
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
        <div><label className="sfa-label">{A.editName}</label><input className="sfa-input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="sfa-label">{A.editMatch}</label>
          <select className="sfa-select" value={matchType} onChange={(e) => setMatchType(e.target.value as any)}>
            <option value="contains">{A.matchContains}</option><option value="exact">{A.matchExact}</option>
          </select>
        </div>
      </div>
      <div><label className="sfa-label">{A.editKeywords}</label><KeywordChips keywords={keywords} setKeywords={setKeywords} /></div>
      {story ? <div className="sfa-sub">{A.storyNoPublicReply}</div> : <div>
        <div className="sfa-step-h" style={{ marginBottom: 6 }}><div>{A.step4}</div><button type="button" className={`sfa-toggle${publicOn ? ' on' : ''}`} onClick={() => setPublicOn((v) => !v)} aria-label={A.publicReplyAria}><span /></button></div>
        {publicOn && (
          <div className="sfa-stack">
            {replies.map((r, i) => (
              <div key={i} className="sfa-reply"><b>{i + 1}</b><input value={r} onChange={(e) => setReplies((rs) => rs.map((x, j) => (j === i ? e.target.value : x)))} placeholder={A.replyPlaceholder} />{replies.length > 1 && <button type="button" onClick={() => setReplies((rs) => rs.filter((_, j) => j !== i))} aria-label={A.removeVariant}>✕</button>}</div>
            ))}
            <button type="button" className="sfa-btn sfa-btn-dashed sfa-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setReplies((rs) => [...rs, ''])}>{A.addVariant}</button>
          </div>
        )}
      </div>}
      <div>
        <div className="sfa-step-h" style={{ marginBottom: 6 }}><div>{A.step5}</div>{!story && <button type="button" className={`sfa-toggle${dmOn ? ' on' : ''}`} onClick={() => setDmOn((v) => !v)} aria-label={A.dmAria}><span /></button>}</div>
        {dmOn && (
          <>
            <textarea className="sfa-textarea" value={dmMessage} onChange={(e) => setDmMessage(e.target.value)} placeholder={A.dmPlaceholder} />
            <div className="sfa-vars">{VARS.map((v) => <button type="button" key={v} onClick={() => setDmMessage((x) => (x ? x + ' ' : '') + v)}>{v}</button>)}</div>
            <label className="sfa-label" style={{ marginTop: 10 }}>{A.dmLinkLabel}</label>
            <input className="sfa-input" dir="ltr" value={dmLink} onChange={(e) => setDmLink(e.target.value)} placeholder="https://" />
          </>
        )}
      </div>
      <div className="sfa-setting"><div><strong>{A.oncePerUser}</strong><small>{A.oncePerUserNote}</small></div><button type="button" className={`sfa-toggle${oncePerUser ? ' on' : ''}`} onClick={() => setOncePerUser((v) => !v)} aria-label={A.oncePerUser}><span /></button></div>
      <div className="foot">
        <button type="button" className="sfa-btn sfa-btn-primary" onClick={save} disabled={saving}>{saving ? A.saving : A.saveChanges}</button>
        <button type="button" className="sfa-btn sfa-btn-ghost" onClick={onCancel} disabled={saving}>{m.common.cancel}</button>
      </div>
    </div>
  );
}
