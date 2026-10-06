'use client';

import { useEffect, useState } from 'react';
import { useI18n } from './I18nProvider';
import { useReadOnly } from './ReadOnlyContext';

/**
 * "Continue the conversation" (follow-up step, beta, 6.10.2026) inside the automation editor:
 * simple (any reply / reply with words -> message) or AI intents + fallback, and the conversation log.
 * API: GET/PUT /api/automations/:id/followup.
 */

interface Intent { label: string; description: string; reply: string; keywords: string }
interface Capability { enabled: boolean; ai: boolean; llm: string | null }
interface Ev { source: string; inbound_text: string | null; outcome: string; decision: string | null; intent: string | null; confidence: number | null; created_at: string }
interface Conv { id: number; recipient_name: string | null; stage: string; replies_seen: number; followups_sent: number; first_dm_at: string; last_error: string | null; events: Ev[] }

export default function FollowupSection({ automationId, platform, onToast }: { automationId: string; platform: string; onToast: (x: string) => void }) {
  const { m, t, dateTime } = useI18n();
  const F = m.followup;
  const ro = useReadOnly();
  const [loaded, setLoaded] = useState(false);
  const [cap, setCap] = useState<Capability | null>(null);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [exists, setExists] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<'simple' | 'ai'>('simple');
  const [anyReply, setAnyReply] = useState(true);
  const [keywords, setKeywords] = useState('');
  const [message, setMessage] = useState('');
  const [intents, setIntents] = useState<Intent[]>([{ label: '', description: '', reply: '', keywords: '' }]);
  const [fallback, setFallback] = useState('');
  const [maxFollowups, setMaxFollowups] = useState(1);
  const [windowHours, setWindowHours] = useState(48);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (platform !== 'instagram') { setLoaded(true); return; }
    fetch(`/api/automations/${automationId}/followup`).then((r) => r.json()).then((d) => {
      setCap(d.capability || null);
      setConvs(d.conversations || []);
      const f = d.followup;
      if (f) {
        setExists(true);
        setEnabled(f.enabled !== false);
        setMode(f.mode === 'ai' ? 'ai' : 'simple');
        setAnyReply(!(f.keywords || []).length);
        setKeywords((f.keywords || []).join(', '));
        setMessage(f.message || '');
        if (f.intents?.length) setIntents(f.intents.map((i: any) => ({ label: i.label || '', description: i.description || '', reply: i.reply || '', keywords: (i.keywords || []).join(', ') })));
        setFallback(f.fallback || '');
        setMaxFollowups(f.max_followups || 1);
        setWindowHours(f.window_hours || 48);
      }
    }).catch(() => {}).finally(() => setLoaded(true));
  }, [automationId, platform]);

  const split = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

  const save = async (remove = false) => {
    setSaving(true);
    try {
      const followup = remove ? null : {
        enabled, mode, keywords: anyReply ? [] : split(keywords), match_type: 'contains', message: message.trim(),
        intents: intents.filter((i) => i.label.trim() && i.reply.trim()).map((i) => ({ label: i.label.trim(), description: i.description.trim(), reply: i.reply.trim(), keywords: split(i.keywords) })),
        fallback: fallback.trim(), max_followups: maxFollowups, window_hours: windowHours,
      };
      const res = await fetch(`/api/automations/${automationId}/followup`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ followup }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((F.errors as Record<string, string>)[d.reason === 'ai_followup' ? 'plan_limit' : d.error] || d.error || 'failed');
      setExists(!remove);
      if (remove) setEnabled(false);
      onToast(remove ? F.removed : F.saved);
    } catch (e: any) { onToast(`${m.common.error}: ${e.message}`); } finally { setSaving(false); }
  };

  if (!loaded) return null;
  if (platform !== 'instagram') return <div className="sfa-sub">{F.title} · {F.instagramOnly}</div>;
  const aiLocked = cap ? !cap.ai : true;

  return (
    <div className="sfa-stack" style={{ gap: 10, borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 12 }}>
      <div className="sfa-step-h" style={{ marginBottom: 2 }}>
        <div>{F.title} <span className="sfa-tag sfa-tag-unsent" style={{ marginInlineStart: 6 }}>{F.beta}</span></div>
        <button type="button" className={`sfa-toggle${enabled ? ' on' : ''}`} onClick={() => setEnabled((v) => !v)} aria-label={F.enable}><span /></button>
      </div>
      <div className="sfa-sub">{F.intro}</div>
      {cap && !cap.enabled && <div className="sfa-sub">⏸ {F.dormant}</div>}
      <div className="sfa-sub">ⓘ {F.metaNote}</div>

      {enabled && (
        <>
          <div className="row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className={`sfa-btn sfa-btn-sm ${mode === 'simple' ? 'sfa-btn-primary' : 'sfa-btn-ghost'}`} onClick={() => setMode('simple')}>{F.modeSimple}</button>
            <button type="button" className={`sfa-btn sfa-btn-sm ${mode === 'ai' ? 'sfa-btn-primary' : 'sfa-btn-ghost'}`} onClick={() => setMode('ai')} disabled={aiLocked && mode !== 'ai'} title={aiLocked ? F.aiLocked : undefined}>{F.modeAi}</button>
          </div>
          {aiLocked && <div className="sfa-sub">{F.aiLocked}</div>}

          {mode === 'simple' ? (
            <>
              <div className="row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <label><input type="radio" checked={anyReply} onChange={() => setAnyReply(true)} /> {F.anyReply}</label>
                <label><input type="radio" checked={!anyReply} onChange={() => setAnyReply(false)} /> {F.withWords}</label>
              </div>
              {!anyReply && <input className="sfa-input" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder={F.intentKeywords} />}
              <label className="sfa-label">{F.message}</label>
              <textarea className="sfa-textarea" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={F.messagePh} />
            </>
          ) : (
            <>
              {cap && !cap.llm && <div className="sfa-sub">⚠ {F.noLlm}</div>}
              <label className="sfa-label">{F.intents}</label>
              <div className="sfa-sub">{F.intentsNote}</div>
              {intents.map((it, i) => (
                <div key={i} className="sfa-stack" style={{ gap: 6, padding: 10, border: '1px solid rgba(255,255,255,.08)', borderRadius: 10 }}>
                  <input className="sfa-input" value={it.label} onChange={(e) => setIntents((xs) => xs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder={F.intentLabel} />
                  <input className="sfa-input" value={it.description} onChange={(e) => setIntents((xs) => xs.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} placeholder={F.intentDesc} />
                  <textarea className="sfa-textarea" value={it.reply} onChange={(e) => setIntents((xs) => xs.map((x, j) => (j === i ? { ...x, reply: e.target.value } : x)))} placeholder={F.intentReply} />
                  <input className="sfa-input" value={it.keywords} onChange={(e) => setIntents((xs) => xs.map((x, j) => (j === i ? { ...x, keywords: e.target.value } : x)))} placeholder={F.intentKeywords} />
                  {intents.length > 1 && <button type="button" className="sfa-btn sfa-btn-ghost sfa-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setIntents((xs) => xs.filter((_, j) => j !== i))}>{F.removeIntent}</button>}
                </div>
              ))}
              {intents.length < 10 && <button type="button" className="sfa-btn sfa-btn-dashed sfa-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setIntents((xs) => [...xs, { label: '', description: '', reply: '', keywords: '' }])}>{F.addIntent}</button>}
              <label className="sfa-label">{F.fallback}</label>
              <textarea className="sfa-textarea" value={fallback} onChange={(e) => setFallback(e.target.value)} placeholder={F.fallbackPh} />
              <div className="sfa-sub">{F.fallbackNote}</div>
            </>
          )}

          <div className="row">
            <div><label className="sfa-label">{F.maxFollowups}</label>
              <select className="sfa-select" value={maxFollowups} onChange={(e) => setMaxFollowups(Number(e.target.value))}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</select>
            </div>
            <div><label className="sfa-label">{F.windowHours}</label>
              <select className="sfa-select" value={windowHours} onChange={(e) => setWindowHours(Number(e.target.value))}>{[12, 24, 48, 72].map((n) => <option key={n} value={n}>{n}</option>)}</select>
            </div>
          </div>
        </>
      )}

      <div className="foot" style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="sfa-btn sfa-btn-cyan sfa-btn-sm" onClick={() => save(false)} disabled={ro || saving}>{F.save}</button>
        {exists && <button type="button" className="sfa-btn sfa-btn-ghost sfa-btn-sm" onClick={() => save(true)} disabled={ro || saving}>{F.remove}</button>}
      </div>

      <div>
        <label className="sfa-label">{F.conversations}</label>
        {!convs.length ? <div className="sfa-sub">{F.noConversations}</div> : (
          <div className="sfa-stack" style={{ gap: 6 }}>
            {convs.map((c) => (
              <div key={c.id} style={{ fontSize: 13, padding: 8, border: '1px solid rgba(255,255,255,.08)', borderRadius: 8 }}>
                <b>{c.recipient_name || '@'}</b> · {(F.stage as Record<string, string>)[c.stage] || c.stage} · {t(F.repliesSeen, { n: c.replies_seen })} · {t(F.followupsSent, { n: c.followups_sent })} · {dateTime(c.first_dm_at)}
                {c.events.map((e, i) => (
                  <div key={i} className="sfa-sub" style={{ marginTop: 4 }}>
                    “{(e.inbound_text || '').slice(0, 120)}” → {(F.outcome as Record<string, string>)[e.outcome] || e.outcome}{e.intent ? ` · ${e.intent}` : ''}{e.confidence != null ? ` · ${Math.round(e.confidence * 100)}%` : ''}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
