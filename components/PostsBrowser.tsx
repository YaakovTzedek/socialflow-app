'use client';

import { useCallback, useEffect, useState } from 'react';
import PostCard, { NormalizedPost } from './PostCard';

/** Manual replies: pick a page or Instagram account, browse its posts, read and
 *  answer comments. Formerly the dashboard; restyled to the app design. */

interface Page { id: string; name: string; category?: string; fan_count?: number; picture?: string; instagram?: { id: string; username?: string; picture?: string; followers?: number } | null }
interface Target { platform: 'facebook' | 'instagram'; pageId: string; id: string; name: string; picture?: string }

export default function PostsBrowser() {
  const [pages, setPages] = useState<Page[]>([]);
  const [loadingPages, setLoadingPages] = useState(true);
  const [target, setTarget] = useState<Target | null>(null);
  const [posts, setPosts] = useState<NormalizedPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/pages');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'failed');
        setPages(data.pages || []);
      } catch (e: any) { setError(e.message); } finally { setLoadingPages(false); }
    })();
  }, []);

  const loadPosts = useCallback(async (t: Target) => {
    setTarget(t); setLoadingPosts(true); setPosts([]); setError(null);
    try {
      if (t.platform === 'facebook') {
        const res = await fetch(`/api/pages/${t.pageId}/posts`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'failed');
        setPosts((data.posts || []).map((p: any) => ({ id: p.id, text: p.message || p.story || '', created_time: p.created_time, permalink: p.permalink_url, image: p.full_picture, likes: p.likes?.summary?.total_count ?? null, comments: p.comments?.summary?.total_count ?? null })));
      } else {
        const res = await fetch(`/api/pages/${t.pageId}/instagram/media?igId=${t.id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'failed');
        setPosts((data.media || []).map((m: any) => ({ id: m.id, text: m.caption || '', created_time: m.timestamp, permalink: m.permalink, image: m.media_url || m.thumbnail_url, likes: m.like_count ?? null, comments: m.comments_count ?? null })));
      }
    } catch (e: any) { setError(e.message); } finally { setLoadingPosts(false); }
  }, []);

  const filtered = pages.filter((p) => p.name.toLowerCase().includes(search.toLowerCase().trim()));

  return (
    <div className="sfa-posts-grid">
      <aside className="sfa-card" style={{ padding: 14 }}>
        <div className="sfa-eyebrow">הדפים שלך {!loadingPages && `(${pages.length})`}</div>
        {!loadingPages && pages.length > 0 && <input className="sfa-input" style={{ marginBottom: 10 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש דף" />}
        {loadingPages ? <div className="sfa-loading"><span className="sfa-spinner" />טוען דפים…</div> : pages.length === 0 ? (
          <div className="sfa-sub">לא נמצאו דפים. ודא שיש לך הרשאות ניהול לפחות לדף פייסבוק אחד.</div>
        ) : (
          <div className="sfa-pages-list">
            {filtered.map((page) => (
              <div key={page.id} className="sfa-stack" style={{ gap: 6 }}>
                <button type="button" className={`sfa-target${target?.platform === 'facebook' && target?.id === page.id ? ' sel' : ''}`} onClick={() => loadPosts({ platform: 'facebook', pageId: page.id, id: page.id, name: page.name, picture: page.picture })}>
                  {page.picture ? <img src={page.picture} alt="" style={{ width: 34, height: 34, borderRadius: 10, objectFit: 'cover' }} /> : <span className="sfa-plat sfa-plat-fb sfa-plat-lg">f</span>}
                  <div><strong>{page.name}</strong><small>{page.category}{page.fan_count != null ? ` · ${page.fan_count.toLocaleString('he-IL')} עוקבים` : ''}</small></div>
                </button>
                {page.instagram && (
                  <button type="button" className={`sfa-target ig${target?.platform === 'instagram' && target?.id === page.instagram.id ? ' sel' : ''}`} onClick={() => loadPosts({ platform: 'instagram', pageId: page.id, id: page.instagram!.id, name: page.instagram!.username ? `@${page.instagram!.username}` : 'Instagram', picture: page.instagram!.picture })}>
                    <span className="sfa-plat sfa-plat-ig sfa-plat-lg">◎</span>
                    <div><strong style={{ direction: 'ltr', textAlign: 'right' }}>{page.instagram.username ? `@${page.instagram.username}` : 'Instagram'}</strong><small>אינסטגרם{page.instagram.followers != null ? ` · ${page.instagram.followers.toLocaleString('he-IL')} עוקבים` : ''}</small></div>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </aside>

      <main className="sfa-stack" style={{ gap: 14 }}>
        {error && <div className="sfa-error">{error}</div>}
        {!target ? (
          <div className="sfa-empty"><b>בחר דף או חשבון אינסטגרם</b>מהרשימה, כדי לראות פוסטים ולענות לתגובות ידנית.</div>
        ) : loadingPosts ? <div className="sfa-loading"><span className="sfa-spinner" />טוען פוסטים…</div> : posts.length === 0 ? (
          <div className="sfa-empty"><b>אין פוסטים להצגה</b></div>
        ) : (
          <>
            <div className="sfa-eyebrow" style={{ marginBottom: 0 }}>{target.platform === 'instagram' ? 'מדיה' : 'פוסטים'} · {target.name}</div>
            {posts.map((post) => <PostCard key={post.id} post={post} pageId={target.pageId} platform={target.platform} />)}
          </>
        )}
      </main>
    </div>
  );
}
