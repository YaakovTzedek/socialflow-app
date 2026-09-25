'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initialsOf } from './DashboardHome';
import { useI18n } from './I18nProvider';

/**
 * Instagram DM inbox: account picker, conversation list and thread view with a
 * reply box. Meta allows a reply only within 24 hours of the person's last
 * message, so the box is disabled (with the reason) once that window closes.
 * API: /api/pages, /api/inbox, /api/inbox/:conversationId.
 * On narrow screens the list and the thread are shown one at a time.
 */

interface Page { id: string; name: string; instagram?: { id: string; username?: string } | null }
interface LastMessage { text: string; inbound: boolean; story: boolean; attachment: string | null; created_time: string | null }
interface Conversation { id: string; updated_time: string | null; participant: { id: string | null; username: string | null }; last_message: LastMessage | null; last_inbound_at: string | null; can_reply: boolean }
interface Message { id: string; created_time: string | null; direction: 'in' | 'out'; text: string; story: boolean; story_id: string | null; attachment: string | null }

const WINDOW_MS = 24 * 60 * 60 * 1000;

export default function InboxScreen() {
  const { m, t, dateTime } = useI18n();
  const I = m.inbox;
  const [pages, setPages] = useState<Page[]>([]);
  const [pagesLoading, setPagesLoading] = useState(true);
  const [pageId, setPageId] = useState('');
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [convsLoading, setConvsLoading] = useState(false);
  const [convsError, setConvsError] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState(false);
  const [canReply, setCanReply] = useState(false);
  const [lastInbound, setLastInbound] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const showToast = (x: string) => { setToast(x); setTimeout(() => setToast(null), 3000); };
  const attLabel = (a: string | null) => (a === 'image' ? I.attImage : a === 'video' ? I.attVideo : a === 'audio' ? I.attAudio : a ? I.attFile : '');

  const igPages = useMemo(() => pages.filter((pg) => pg.instagram?.id), [pages]);

  useEffect(() => {
    fetch('/api/pages').then((r) => r.json()).then((d) => {
      const list: Page[] = d.pages || [];
      setPages(list);
      const first = list.find((pg) => pg.instagram?.id);
      if (first) setPageId((cur) => cur || first.id);
      if (d.stale) fetch('/api/pages?refresh=1').then((r) => r.json()).then((f) => { if (f.pages) setPages(f.pages); }).catch(() => {});
    }).catch(() => {}).finally(() => setPagesLoading(false));
  }, []);

  const loadConvs = useCallback(async (pid: string) => {
    if (!pid) return;
    setConvsLoading(true);
    setConvsError(false);
    try {
      const res = await fetch(`/api/inbox?page_id=${encodeURIComponent(pid)}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'failed');
      setConvs(d.conversations || []);
    } catch {
      setConvs([]);
      setConvsError(true);
    } finally { setConvsLoading(false); }
  }, []);

  useEffect(() => { setOpenId(null); setThread([]); loadConvs(pageId); }, [pageId, loadConvs]);

  const loadThread = useCallback(async (cid: string) => {
    setThreadLoading(true);
    setThreadError(false);
    try {
      const res = await fetch(`/api/inbox/${encodeURIComponent(cid)}?page_id=${encodeURIComponent(pageId)}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'failed');
      setThread(d.messages || []);
      setCanReply(!!d.can_reply);
      setLastInbound(d.last_inbound_at || null);
    } catch {
      setThread([]);
      setCanReply(false);
      setThreadError(true);
    } finally { setThreadLoading(false); }
  }, [pageId]);

  useEffect(() => { if (openId) { setText(''); loadThread(openId); } }, [openId, loadThread]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [thread]);

  const open = convs.find((c) => c.id === openId) || null;
  const who = (c: Conversation | null) => (c?.participant.username ? `@${c.participant.username}` : I.unknownUser);

  const send = async () => {
    const body = text.trim();
    if (!openId || !body || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/inbox/${encodeURIComponent(openId)}?page_id=${encodeURIComponent(pageId)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: body }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.status === 409) { setCanReply(false); showToast(I.windowClosed); return; }
      if (!res.ok) throw new Error(d.error || 'failed');
      setThread((th) => [...th, d.message]);
      setText('');
      setConvs((cs) => cs.map((c) => (c.id === openId ? { ...c, updated_time: d.message.created_time, last_message: { text: body, inbound: false, story: false, attachment: null, created_time: d.message.created_time } } : c)));
      showToast(I.sent);
    } catch (e: any) {
      showToast(`${m.common.error}: ${e.message}`);
    } finally { setSending(false); }
  };

  const until = lastInbound ? dateTime(new Date(Date.parse(lastInbound) + WINDOW_MS)) : null;

  return (
    <>
      <div className="sfa-head">
        <div>
          <div className="sfa-h">{I.title}</div>
          <p>{I.sub}</p>
        </div>
        <div className="sfa-inbox-tools">
          {igPages.length > 0 && (
            <label className="sfa-inbox-acc">
              <span className="sfa-label">{I.account}</span>
              <select className="sfa-select" value={pageId} onChange={(e) => setPageId(e.target.value)}>
                {igPages.map((pg) => <option key={pg.id} value={pg.id}>{pg.instagram?.username ? `@${pg.instagram.username}` : pg.name}</option>)}
              </select>
            </label>
          )}
          <button type="button" className="sfa-btn sfa-btn-ghost sfa-btn-sm" onClick={() => (openId ? loadThread(openId) : loadConvs(pageId))} disabled={!pageId || convsLoading || threadLoading}>{I.refresh}</button>
        </div>
      </div>

      {pagesLoading ? <div className="sfa-loading"><span className="sfa-spinner" />{m.common.loading}</div> : igPages.length === 0 ? (
        <div className="sfa-empty"><b>{I.emptyTitle}</b>{I.noIgPages}</div>
      ) : (
        <div className={`sfa-inbox${openId ? ' has-thread' : ''}`}>
          <div className="sfa-card sfa-inbox-list">
            {convsLoading ? <div className="sfa-loading" style={{ padding: 16 }}><span className="sfa-spinner" />{I.loading}</div> : convsError ? (
              <div className="sfa-empty" style={{ margin: 12 }}><b>{m.common.error}</b>{I.loadError}</div>
            ) : convs.length === 0 ? (
              <div className="sfa-empty" style={{ margin: 12 }}><b>{I.emptyTitle}</b>{I.emptyText}</div>
            ) : convs.map((c) => (
              <button type="button" key={c.id} className={`sfa-inbox-row${c.id === openId ? ' sel' : ''}`} onClick={() => setOpenId(c.id)}>
                <span className="sfa-initials">{initialsOf(c.participant.username || '')}</span>
                <div className="body">
                  <div className="top">
                    <strong dir="ltr">{who(c)}</strong>
                    {c.updated_time && <small>{dateTime(c.updated_time)}</small>}
                  </div>
                  <p>
                    {c.last_message?.story && <span className="sfa-story-badge">{I.storyBadge}</span>}
                    {c.last_message && !c.last_message.inbound && <b>{I.you}: </b>}
                    {c.last_message ? (c.last_message.text || attLabel(c.last_message.attachment) || I.noText) : ''}
                  </p>
                </div>
                {!c.can_reply && <span className="sfa-tag sfa-tag-unsent">{I.closedTag}</span>}
              </button>
            ))}
          </div>

          <div className="sfa-card sfa-inbox-thread">
            {!openId ? <div className="sfa-sub" style={{ padding: 20 }}>{I.chooseConversation}</div> : (
              <>
                <div className="sfa-inbox-thread-h">
                  <button type="button" className="sfa-btn sfa-btn-ghost sfa-btn-sm sfa-inbox-back" onClick={() => setOpenId(null)}>{I.back}</button>
                  <strong dir="ltr">{who(open)}</strong>
                </div>
                <div className="sfa-inbox-msgs">
                  {threadLoading ? <div className="sfa-loading"><span className="sfa-spinner" />{m.common.loading}</div> : threadError ? (
                    <div className="sfa-empty"><b>{m.common.error}</b>{I.loadError}</div>
                  ) : thread.map((msg) => (
                    <div key={msg.id} className={`sfa-inbox-msg ${msg.direction}`}>
                      <div className={`sfa-bubble ${msg.direction === 'in' ? 'sfa-bubble-user' : 'sfa-bubble-dm'}`}>
                        {msg.story && <span className="sfa-story-badge">{I.storyBadge}</span>}
                        {msg.attachment && <small>{attLabel(msg.attachment)}</small>}
                        <span style={{ whiteSpace: 'pre-wrap' }}>{msg.text || (msg.attachment ? '' : I.noText)}</span>
                      </div>
                      {msg.created_time && <small className="when">{dateTime(msg.created_time)}</small>}
                    </div>
                  ))}
                  <div ref={endRef} />
                </div>
                <div className="sfa-inbox-reply">
                  {!threadLoading && !threadError && (canReply
                    ? (until && <small className="sfa-sub">{t(I.windowUntil, { when: until })}</small>)
                    : <div className="sfa-warn">{I.windowClosed}</div>)}
                  <div className="row">
                    <textarea className="sfa-textarea" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder={I.placeholder} disabled={!canReply || sending || threadLoading}
                      onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }} />
                    <button type="button" className="sfa-btn sfa-btn-primary" onClick={send} disabled={!canReply || sending || !text.trim()}>{sending ? I.sending : I.send}</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {toast && <div className="sfa-toast">{toast}</div>}
    </>
  );
}
