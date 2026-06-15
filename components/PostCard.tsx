'use client';

import { useState } from 'react';

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

interface Comment {
  id: string;
  message?: string;
  created_time: string;
  like_count?: number;
  comment_count?: number;
  from?: { id: string; name?: string };
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function PostCard({
  post,
  pageId,
}: {
  post: Post;
  pageId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const commentCount = post.comments?.summary?.total_count ?? 0;
  const likeCount = post.likes?.summary?.total_count ?? 0;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const loadComments = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    setLoadingComments(true);
    try {
      const res = await fetch(
        `/api/posts/${post.id}/comments?pageId=${pageId}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed');
      setComments(data.comments || []);
    } catch (e: any) {
      showToast('שגיאה בטעינת תגובות: ' + e.message);
    } finally {
      setLoadingComments(false);
    }
  };

  const submitComment = async () => {
    if (!newComment.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/posts/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, message: newComment.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed');
      showToast('✅ התגובה פורסמה');
      setNewComment('');
      // Refresh comments if expanded
      if (expanded) {
        const r = await fetch(`/api/posts/${post.id}/comments?pageId=${pageId}`);
        const d = await r.json();
        setComments(d.comments || []);
      }
    } catch (e: any) {
      showToast('שגיאה: ' + e.message);
    } finally {
      setPosting(false);
    }
  };

  const submitReply = async (commentId: string) => {
    if (!replyText.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/comments/${commentId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, message: replyText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed');
      showToast('✅ התגובה נשלחה');
      setReplyText('');
      setReplyingTo(null);
    } catch (e: any) {
      showToast('שגיאה: ' + e.message);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Post body */}
      <div className="p-5">
        <div className="flex items-start gap-3">
          {post.full_picture && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.full_picture}
              alt=""
              className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
              {post.message || post.story || '(פוסט ללא טקסט)'}
            </p>
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
              <span>{formatDate(post.created_time)}</span>
              <span>👍 {likeCount}</span>
              <span>💬 {commentCount}</span>
              {post.permalink_url && (
                <a
                  href={post.permalink_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-600 hover:underline"
                >
                  צפה בפייסבוק ↗
                </a>
              )}
            </div>
          </div>
        </div>

        {/* New comment box */}
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitComment()}
            placeholder="כתוב תגובה לפוסט הזה..."
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500"
          />
          <button
            onClick={submitComment}
            disabled={posting || !newComment.trim()}
            className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-5 disabled:opacity-50 transition-colors"
          >
            {posting ? '...' : 'פרסם'}
          </button>
        </div>

        <button
          onClick={loadComments}
          className="mt-3 text-sm text-brand-600 hover:underline"
        >
          {expanded ? 'הסתר תגובות' : `הצג תגובות (${commentCount})`}
        </button>
      </div>

      {/* Comments */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-5 space-y-3">
          {loadingComments ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <span className="spinner" /> טוען תגובות...
            </div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-gray-400">אין תגובות עדיין.</p>
          ) : (
            comments.map((c) => (
              <div
                key={c.id}
                className="bg-white rounded-xl border border-gray-200 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">
                    {c.from?.name || 'משתמש'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDate(c.created_time)}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
                  {c.message}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                  <span>👍 {c.like_count ?? 0}</span>
                  <button
                    onClick={() =>
                      setReplyingTo(replyingTo === c.id ? null : c.id)
                    }
                    className="text-brand-600 hover:underline"
                  >
                    הגב
                  </button>
                </div>

                {replyingTo === c.id && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === 'Enter' && submitReply(c.id)
                      }
                      placeholder="כתוב תשובה..."
                      autoFocus
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
                    />
                    <button
                      onClick={() => submitReply(c.id)}
                      disabled={posting || !replyText.trim()}
                      className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 disabled:opacity-50"
                    >
                      שלח
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
