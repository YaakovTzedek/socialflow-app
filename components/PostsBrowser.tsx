'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import PostCard, { NormalizedPost } from './PostCard';
import { useI18n } from './I18nProvider';

/**
 * Manual replies: pick a page or Instagram account, browse its posts, read and answer comments.
 *
 * Speed: the page list is shown at once from this tab's last copy
 * (sessionStorage) while the server answers, a stale server cache refreshes in
 * the background, and posts already loaded for a page are shown again
 * instantly on the next click.
 */
const PAGES_KEY = 'sf_pages_v1';

interface Page { id: string; name: string; category?: string; fan_count?: number; picture?: string; instagram?: { id: string; username?: string; picture?: string; followers?: number } | null }
interface Target { platform: 'facebook' | 'instagram'; pageId: string; id: string; name: string; picture?: string }

export default function PostsBrowser() {
  const { m, num } = useI18n();
  const P = m.posts;
  const [pages, setPages] = useState<Page[]>([]);
  const [loadingPages, setLoadingPages] = useState(true);
  const [target, setTarget] = useState<Target | null>(null);
  const [posts, setPosts] = useState<NormalizedPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const postsCache = useRef(new Map<string, NormalizedPost[]>());
  const current = useRef('');

  useEffect(() => {
    const keep = (list: Page[]) => { setPages(list); try { sessionStorage.setItem(PAGES_KEY, JSON.stringify(list)); } catch { /* private mode */ } };
    try {
      const saved = sessionStorage.getItem(PAGES_KEY);
      if (saved) { setPages(JSON.parse(saved)); setLoadingPages(false); }
    } catch { /* ignore */ }
    (async () => {
      try {
        const res = await fetch('/api/pages'); const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'failed');
        keep(data.pages || []);
        if (data.stale) fetch('/api/pages?refresh=1').then((r) => r.json()).then((f) => { if (f.pages) keep(f.pages); }).catch(() => {});
      } catch (e: any) {
        // Never keep showing a saved list the server no longer vouches for.
        try { sessionStorage.removeItem(PAGES_KEY); } catch { /* ignore */ }
        setPages([]); setError(e.message);
      } finally { setLoadingPages(false); }
    })();
  }, []);

  const loadPosts = useCallback(async (t: Target) => {
    const cacheKey = `${t.platform}:${t.id}`;
    const cached = postsCache.current.get(cacheKey);
    current.current = cacheKey;
    setTarget(t); setError(null);
    if (cached) { setPosts(cached); setLoadingPosts(false); return; }
    setLoadingPosts(true); setPosts([]);
    try {
      if (t.platform === 'facebook') {
        const res = await fetch(`/api/pages/${t.pageId}/posts`); const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'failed');
        const list: NormalizedPost[] = (data.posts || []).map((p: any) => ({ id: p.id, text: p.message || p.story || '', created_time: p.created_time, permalink: p.permalink_url, image: p.full_picture, likes: p.likes?.summary?.total_count ?? null, comments: p.comments?.summary?.total_count ?? null }));
        postsCache.current.set(cacheKey, list); if (current.current === cacheKey) setPosts(list);
      } else {
        const res = await fetch(`/api/pages/${t.pageId}/instagram/media?igId=${t.id}`); const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'failed');
        const list: NormalizedPost[] = (data.media || []).map((x: any) => ({ id: x.id, text: x.caption || '', created_time: x.timestamp, permalink: x.permalink, image: x.media_url || x.thumbnail_url, likes: x.like_count ?? null, comments: x.comments_count ?? null }));
        postsCache.current.set(cacheKey, list); if (current.current === cacheKey) setPosts(list);
      }
    } catch (e: any) { if (current.current === cacheKey) setError(e.message); } finally { if (current.current === cacheKey) setLoadingPosts(false); }
  }, []);

  const filtered = pages.filter((p) => p.name.toLowerCase().includes(search.toLowerCase().trim()));

  return (
    <div className="sfa-posts-grid">
      <aside className="sfa-card" style={{ padding: 14 }}>
        <div className="sfa-eyebrow">{P.yourPages} {!loadingPages && `(${pages.length})`}</div>
        {!loadingPages && pages.length > 0 && <input className="sfa-input" style={{ marginBottom: 10 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={P.searchPage} />}
        {loadingPages ? <div className="sfa-loading"><span className="sfa-spinner" />{P.loadingPages}</div> : pages.length === 0 ? (
          <div className="sfa-sub">{P.noPages}</div>
        ) : (
          <div className="sfa-pages-list">
            {filtered.map((page) => (
              <div key={page.id} className="sfa-stack" style={{ gap: 6 }}>
                <button type="button" className={`sfa-target${target?.platform === 'facebook' && target?.id === page.id ? ' sel' : ''}`} onClick={() => loadPosts({ platform: 'facebook', pageId: page.id, id: page.id, name: page.name, picture: page.picture })}>
                  {page.picture ? <img src={page.picture} alt="" style={{ width: 34, height: 34, borderRadius: 10, objectFit: 'cover' }} /> : <span className="sfa-plat sfa-plat-fb sfa-plat-lg">f</span>}
                  <div><strong>{page.name}</strong><small>{page.category}{page.fan_count != null ? ` · ${num(page.fan_count)} ${m.common.followers}` : ''}</small></div>
                </button>
                {page.instagram && (
                  <button type="button" className={`sfa-target ig${target?.platform === 'instagram' && target?.id === page.instagram.id ? ' sel' : ''}`} onClick={() => loadPosts({ platform: 'instagram', pageId: page.id, id: page.instagram!.id, name: page.instagram!.username ? `@${page.instagram!.username}` : 'Instagram', picture: page.instagram!.picture })}>
                    <span className="sfa-plat sfa-plat-ig sfa-plat-lg">◎</span>
                    <div><strong style={{ direction: 'ltr', textAlign: 'start' }}>{page.instagram.username ? `@${page.instagram.username}` : 'Instagram'}</strong><small>{m.common.instagram}{page.instagram.followers != null ? ` · ${num(page.instagram.followers)} ${m.common.followers}` : ''}</small></div>
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
          <div className="sfa-empty"><b>{P.pickTitle}</b>{P.pickText}</div>
        ) : loadingPosts ? <div className="sfa-loading"><span className="sfa-spinner" />{P.loadingPosts}</div> : posts.length === 0 ? (
          <div className="sfa-empty"><b>{P.noPosts}</b></div>
        ) : (
          <>
            <div className="sfa-eyebrow" style={{ marginBottom: 0 }}>{target.platform === 'instagram' ? m.common.media : m.common.posts} · {target.name}</div>
            {posts.map((post) => <PostCard key={post.id} post={post} pageId={target.pageId} platform={target.platform} />)}
          </>
        )}
      </main>
    </div>
  );
}
