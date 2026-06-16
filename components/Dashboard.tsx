'use client';

import { useEffect, useState, useCallback } from 'react';
import PostCard from './PostCard';

interface Page {
  id: string;
  name: string;
  category?: string;
  fan_count?: number;
  picture?: string;
}

interface Post {
  id: string;
  message?: string;
  story?: string;
  created_time: string;
  permalink_url?: string;
  full_picture?: string;
  comments?: { summary?: { total_count: number } };
  likes?: { summary?: { total_count: number } };
}

export default function Dashboard({ userName }: { userName: string }) {
  const [pages, setPages] = useState<Page[]>([]);
  const [loadingPages, setLoadingPages] = useState(true);
  const [selectedPage, setSelectedPage] = useState<Page | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
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

  const loadPosts = useCallback(async (page: Page) => {
    setSelectedPage(page);
    setLoadingPosts(true);
    setPosts([]);
    setError(null);
    try {
      const res = await fetch(`/api/pages/${page.id}/posts`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed');
      setPosts(data.posts || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  return (
    <div className="min-h-screen">
      {/* Header */}
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

      <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
        {/* Sidebar: pages */}
        <aside>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-sm font-semibold text-gray-500">
              הדפים שלך {!loadingPages && `(${pages.length})`}
            </h2>
          </div>
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
              {pages
                .filter((p) =>
                  p.name.toLowerCase().includes(search.toLowerCase().trim())
                )
                .map((page) => (
                <button
                  key={page.id}
                  onClick={() => loadPosts(page)}
                  className={`w-full text-right flex items-center gap-3 rounded-xl border p-3 transition-all ${
                    selectedPage?.id === page.id
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
              ))}
            </div>
          )}
        </aside>

        {/* Main: posts */}
        <main>
          {error && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {!selectedPage ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-16 text-center text-gray-400">
              <p className="text-lg font-medium mb-1">בחר דף כדי להתחיל</p>
              <p className="text-sm">
                בחר דף מהרשימה כדי לראות את הפוסטים ולהגיב לתגובות
              </p>
            </div>
          ) : loadingPosts ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm p-8 justify-center">
              <span className="spinner" /> טוען פוסטים...
            </div>
          ) : posts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500">
              אין פוסטים להצגה בדף הזה.
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-500 px-1">
                פוסטים אחרונים · {selectedPage.name}
              </h2>
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  pageId={selectedPage.id}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
