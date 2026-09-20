'use client';

import { useState } from 'react';

export interface NormalizedPost {
  id: string;
  text: string;
  created_time?: string;
  permalink?: string;
  image?: string;
  likes?: number | null;
  comments?: number | null;
}

interface NormalizedComment {
  id: string;
  author: string;
  text: string;
  created_time?: string;
  likes?: number;
}

type Platform = 'facebook' | 'instagram';

function formatDate(iso?: string) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export default function PostCard({ post, pageId, platform }: { post: NormalizedPost; pageId: string; platform: Platform }) {
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<NormalizedComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // Endpoint builders per platform
  const commentsUrl = () =>
    platform === 'facebook' ? `/api/posts/${post.id}/comments?pageId=${pageId}` : `/api/instagram/media/${post.id}/comments?pageId=${pageId}`;
  const postCommentUrl = () => (platform === 'facebook' ? `/api/posts/${post.id}/comments` : `/api/instagram/media/${post.id}/comments`);
  const replyUrl = (commentId: string) => (platform === 'facebook' ? `/api/comments/${commentId}/reply` : `/api/instagram/comments/${commentId}/reply`);

  const normalizeComments = (raw: any[]): NormalizedComment[] =>
    raw.map((c) =>
      platform === 'facebook'
        ? { id: c.id, author: c.from?.name || 'משתמש', text: c.message || '', created_time: c.created_time, likes: c.like_count ?? 0 }
        : { id: c.id, author: c.username ? `@${c.username}` : 'משתמש', text: c.text || '', created_time: c.timestamp, likes: c.like_count ?? 0 }
    );

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2800); };

  const loadComments = async () => {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true); setLoadingComments(true);
    try {
      const res = await fetch(commentsUrl());
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed');
      setComments(normalizeComments(data.comments || []));
    } catch (e: any) { showToast('שגיאה בטעינת תגובות: ' + e.message); } finally { setLoadingComments(false); }
  };

  const submitComment = async () => {
    if (!newComment.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(postCommentUrl(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pageId, message: newComment.trim() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed');
      showToast('התגובה פורסמה');
      setNewComment('');
      if (expanded) {
        const r = await fetch(commentsUrl());
        const d = await r.json();
        if (r.ok) setComments(normalizeComments(d.comments || []));
      }
    } catch (e: any) { showToast('שגיאה: ' + e.message); } finally { setPosting(false); }
  };

  const submitReply = async (commentId: string) => {
    if (!replyText.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(replyUrl(commentId), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pageId, message: replyText.trim() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed');
      showToast('התגובה נשלחה');
      setReplyText(''); setReplyingTo(null);
    } catch (e: any) { showToast('שגיאה: ' + e.message); } finally { setPosting(false); }
  };

  const isIG = platform === 'instagram';

  return (
    <div className="sfa-postcard">
      <div className="sfa-postcard-h">
        {post.image && <img src={post.image} alt="" />}
        <div style={{ minWidth: 0, flex: 1 }}>
          <span className={`sfa-plat ${isIG ? 'sfa-plat-ig' : 'sfa-plat-fb'}`} style={{ marginBottom: 8 }}>{isIG ? '◎' : 'f'}</span>
          <p style={{ whiteSpace: 'pre-wrap' }}>{post.text || '(פוסט ללא טקסט)'}</p>
          <div className="sfa-postcard-meta">
            <span>{formatDate(post.created_time)}</span>
            {post.likes != null && <span>👍 {post.likes}</span>}
            {post.comments != null && <span>💬 {post.comments}</span>}
            {post.permalink && <a href={post.permalink} target="_blank" rel="noreferrer">צפייה {isIG ? 'באינסטגרם' : 'בפייסבוק'} ↗</a>}
            <button type="button" className="sfa-btn sfa-btn-ghost sfa-btn-sm" style={{ padding: '5px 12px', fontSize: 13 }} onClick={loadComments}>{expanded ? 'הסתר תגובות' : 'הצג תגובות'}</button>
          </div>
          <div className="sfa-inline-form" style={{ marginTop: 12 }}>
            <input className="sfa-input" value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitComment()} placeholder="תגובה חדשה לפוסט" />
            <button type="button" className="sfa-btn sfa-btn-primary sfa-btn-sm" onClick={submitComment} disabled={posting || !newComment.trim()}>{posting ? '…' : 'פרסום'}</button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="sfa-comments">
          {loadingComments ? <div className="sfa-loading"><span className="sfa-spinner" />טוען תגובות…</div> : comments.length === 0 ? <div className="sfa-sub">אין תגובות עדיין.</div> : comments.map((c) => (
            <div key={c.id} className="sfa-cmt">
              <span className="sfa-initials">{c.author.replace(/^@/, '').slice(0, 2)}</span>
              <div className="sfa-bubble sfa-bubble-dm" style={{ flex: 1 }}>
                <small>{c.author} <span style={{ color: '#6c7ea0', fontWeight: 400 }}>· {formatDate(c.created_time)}</span></small>
                <span style={{ whiteSpace: 'pre-wrap' }}>{c.text}</span>
                <div className="sfa-cmt-acts">
                  <span style={{ color: '#8fa3c8' }}>👍 {c.likes ?? 0}</span>
                  <button type="button" onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)}>תשובה</button>
                </div>
                {replyingTo === c.id && (
                  <div className="sfa-inline-form" style={{ marginTop: 8 }}>
                    <input className="sfa-input" value={replyText} onChange={(e) => setReplyText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitReply(c.id)} placeholder="כתוב תשובה" autoFocus />
                    <button type="button" className="sfa-btn sfa-btn-primary sfa-btn-sm" onClick={() => submitReply(c.id)} disabled={posting || !replyText.trim()}>שליחה</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && <div className="sfa-toast">{toast}</div>}
    </div>
  );
}
