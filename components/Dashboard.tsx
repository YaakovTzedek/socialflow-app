'use client';

import { useEffect, useState, useCallback } from 'react';
import PostCard, { NormalizedPost } from './PostCard';

interface InstagramInfo {
  id: string;
  username?: string;
  picture?: string;
  followers?: number;
}

interface Page {
  id: string;
  name: string;
  category?: string;
  fan_count?: number;
  picture?: string;
  instagram?: InstagramInfo | null;
}

// A selected target is either a Facebook page or a page's linked Instagram account.
interface Target {
  platform: 'facebook' | 'instagram';
  pageId: string; // FB page id — always used for token resolution
  id: string; // FB page id, or IG account id
  name: string;
  picture?: string;
}

export default function Dashboard({ userName }: { userName: string }) {
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
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoadingPages(false);
      }
    })();
  }, []);

  const loadPosts = useCallback(async (t: Target) => {
    setTarget(t);
    setLoadingPosts(true);
    setPosts([]);
    setError(null);
    try {
      if (t.platform === 'facebook') {
        const res = await fetch(`/api/pages/${t.pageId}/posts`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'failed');
        const normalized: NormalizedPost[] = (data.posts || []).map((p: any) => ({
          id: p.id,
          text: p.message || p.story || '',
          created_time: p.created_time,
          permalink: p.permalink_url,
          image: p.full_picture,
          likes: p.likes?.summary?.total_count ?? null,
          comments: p.comments?.summary?.total_count ?? null,
        }));
        setPosts(normalized);
      } else {
        const res = await fetch(
          `/api/pages/${t.pageId}/instagram/media?igId=${t.id}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'failed');
        const normalized: NormalizedPost[] = (data.media || []).map((m: any) => ({
          id: m.id,
          text: m.caption || '',
          created_time: m.timestamp,
          permalink: m.permalink,
          image: m.media_url || m.thumbnail_url,
          likes: m.like_count ?? null,
          comments: m.comments_count ?? null,
        }));
        setPosts(normalized);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  const filtered = pages.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase().trim())
  );

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none">SocialFlow</h1>
              <p className="text-xs text-gray-400 mt-0.5">שלום, {userName}</p>
            </div>
          </div>
          <a
            href="/api/auth/logout"
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            התנתק
          </a>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6">
        <aside>
          <h2 className="text-sm font-semibold text-gray-500 mb-3 px-1">
            הדפים שלך {!loadingPages && `(${pages.length})`}
          </h2>
          {!loadingPages && pages.length > 0 && (
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 חפש דף..."
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm mb-3 focus:outline-none focus:border-brand-500"
            />
          )}
          {loadingPages ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm p-3">
              <span className="spinner" /> טוען דפים...
            </div>
          ) : pages.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 text-sm text-gray-500">
              לא נמצאו דפים. ודא שיש לך הרשאות ניהול לפחות לדף פייסבוק אחד.
            </div>
          ) : (
            <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto pl-1">
              {filtered.map((page) => (
                <div key={page.id} className="space-y-1.5">
                  <button
                    onClick={() =>
                      loadPosts({
                        platform: 'facebook',
                        pageId: page.id,
                        id: page.id,
                        name: page.name,
                        picture: page.picture,
                      })
                    }
                    className={`w-full text-right flex items-center gap-3 rounded-xl border p-3 transition-all ${
                      target?.platform === 'facebook' && target?.id === page.id
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-gray-200 bg-white hover:border-brand-300'
                    }`}
                  >
                    {page.picture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={page.picture}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{page.name}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {page.category}
                        {page.fan_count != null
                          ? ` · ${page.fan_count.toLocaleString()} עוקבים`
                          : ''}
                      </p>
                    </div>
                  </button>

                  {/* Linked Instagram account */}
                  {page.instagram && (
                    <button
                      onClick={() =>
                        loadPosts({
                          platform: 'instagram',
                          pageId: page.id,
                          id: page.instagram!.id,
                          name: page.instagram!.username
                            ? `@${page.instagram!.username}`
                            : 'Instagram',
                          picture: page.instagram!.picture,
                        })
                      }
                      className={`w-full text-right flex items-center gap-3 rounded-xl border p-2.5 mr-4 transition-all ${
                        target?.platform === 'instagram' &&
                        target?.id === page.instagram.id
                          ? 'border-pink-500 bg-pink-50'
                          : 'border-gray-200 bg-white hover:border-pink-300'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center flex-shrink-0">
                        <svg
                          className="w-4 h-4 text-white"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 2.2c3.2 0 3.6 0 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s0 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58 0-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.2 15.58 2.2 15.2 2.2 12s0-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.2 8.8 2.2 12 2.2zm0 3.65A6.15 6.15 0 1 0 18.15 12 6.15 6.15 0 0 0 12 5.85zm0 10.15A4 4 0 1 1 16 12a4 4 0 0 1-4 4zm6.4-10.55a1.44 1.44 0 1 1-1.44-1.44 1.44 1.44 0 0 1 1.44 1.44z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-xs truncate">
                          {page.instagram.username
                            ? `@${page.instagram.username}`
                            : 'Instagram'}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate">
                          Instagram
                          {page.instagram.followers != null
                            ? ` · ${page.instagram.followers.toLocaleString()} עוקבים`
                            : ''}
                        </p>
                      </div>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </aside>

        <main>
          {error && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {!target ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-16 text-center text-gray-400">
              <p className="text-lg font-medium mb-1">בחר דף או חשבון אינסטגרם</p>
              <p className="text-sm">
                בחר מהרשימה כדי לראות פוסטים ולהגיב לתגובות
              </p>
            </div>
          ) : loadingPosts ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm p-8 justify-center">
              <span className="spinner" /> טוען פוסטים...
            </div>
          ) : posts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500">
              אין פוסטים להצגה.
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-500 px-1">
                {target.platform === 'instagram' ? 'מדיה' : 'פוסטים'} · {target.name}
              </h2>
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  pageId={target.pageId}
                  platform={target.platform}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
