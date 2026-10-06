/**
 * Continued DM conversation ("follow-up step"), 6.10.2026, asked for by Tolik (beta tester).
 *
 * Today an automation sends ONE private message after a comment / story reply and never reads
 * the answer. A follow-up step reads the person's reply to that message and answers once more:
 *   - simple: "they replied anything" or "the reply contains one of these words" -> message X;
 *   - ai:     an LLM classifies the free-text reply into one of the owner's intents
 *             (label + description + reply text) -> that intent's reply text, else the fallback.
 *
 * This file is the whole decision engine and is deliberately free of imports (no database, no
 * fetch, no Next), so `node --test` can exercise it with an in-memory store. lib/followup.ts wires
 * it to Postgres, the Graph API and the LLM.
 *
 * Safety rules enforced here, not in the callers:
 *   1. Only text the owner configured is ever sent. The LLM returns an intent id and a confidence,
 *      never text; an id that is not configured is treated as "no intent". No links are invented.
 *   2. Each inbound message is handled at most once (claimed by its message id), so the webhook and
 *      the poller delivering the same message produce one reply.
 *   3. Each follow-up step is sent at most once per conversation (an optimistic claim on the
 *      followups_sent counter), and a conversation gets at most `max_followups` (cap 3) replies.
 *   4. Our own messages (echoes, or a sender id that is the page / IG account) are never answered.
 *   5. Meta's 24 hour rule: only a message the person wrote less than 24 hours ago is answered, and
 *      only while the conversation's follow-up window (default 48h after our first DM) is open.
 */

/* ------------------------------------------------------------------------ */
/* Config                                                                     */
/* ------------------------------------------------------------------------ */

export interface FollowupIntent {
  /** Stable id the classifier answers with (derived from the label when not given). */
  id: string;
  label: string;
  /** What this intent means, for the classifier ("asks about the price"). */
  description: string;
  /** The exact text sent when the reply matches (may contain the owner's link). */
  reply: string;
  /** Optional words that select this intent without asking the LLM. */
  keywords: string[];
}

export interface FollowupConfig {
  enabled: boolean;
  mode: 'simple' | 'ai';
  /** simple: words that must appear in the reply (empty = any reply). */
  keywords: string[];
  match_type: 'contains' | 'exact';
  /** simple: the text sent. */
  message: string;
  /** ai: the intents. */
  intents: FollowupIntent[];
  /** ai: sent when no intent matches or the confidence is low. Empty = send nothing. */
  fallback: string;
  /** ai: below this the classification counts as "no intent". */
  min_confidence: number;
  /** Replies per conversation (1-3). */
  max_followups: number;
  /** How long after our first DM a reply is still followed up (hours, 1-72). */
  window_hours: number;
}

export const LIMITS = {
  maxFollowups: 3,
  maxIntents: 10,
  maxText: 1000,
  maxLabel: 40,
  maxDescription: 300,
  maxKeywords: 20,
  windowHoursMin: 1,
  windowHoursMax: 72,
  defaultWindowHours: 48,
  defaultMinConfidence: 0.6,
} as const;

/** Meta accepts a reply only within 24 hours of the person's last message; stay inside it. */
export const REPLY_WINDOW_MS = 23.5 * 3600_000;

export type NormalizeResult = { ok: true; config: FollowupConfig } | { ok: false; error: string };

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const words = (v: unknown): string[] =>
  Array.isArray(v) ? Array.from(new Set(v.map((k) => String(k ?? '').trim()).filter(Boolean))).slice(0, LIMITS.maxKeywords) : [];

export function slugId(label: string, i: number): string {
  const s = label.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '').slice(0, 30);
  return s || `intent_${i + 1}`;
}

/**
 * Validate and clamp a follow-up config coming from the UI, the API or MCP.
 * Returns an error code (not a sentence) the caller translates.
 */
export function normalizeFollowup(input: unknown): NormalizeResult {
  if (input === null || input === undefined) return { ok: false, error: 'missing' };
  if (typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'invalid' };
  const o = input as Record<string, unknown>;
  const mode = o.mode === 'ai' ? 'ai' : 'simple';
  const enabled = o.enabled !== false;
  const max = Math.round(Number(o.max_followups ?? 1));
  const hours = Math.round(Number(o.window_hours ?? LIMITS.defaultWindowHours));
  let conf = Number(o.min_confidence ?? LIMITS.defaultMinConfidence);
  if (!Number.isFinite(conf)) conf = LIMITS.defaultMinConfidence;

  const intents: FollowupIntent[] = [];
  const seen = new Set<string>();
  if (Array.isArray(o.intents)) {
    for (const [i, raw] of o.intents.slice(0, LIMITS.maxIntents).entries()) {
      if (!raw || typeof raw !== 'object') continue;
      const r = raw as Record<string, unknown>;
      const label = str(r.label, LIMITS.maxLabel);
      const reply = str(r.reply, LIMITS.maxText);
      if (!label || !reply) continue;
      let id = str(r.id, 40) ? slugId(str(r.id, 40), i) : slugId(label, i);
      while (seen.has(id) || id === 'none') id = `${id}_${i + 1}`;
      seen.add(id);
      intents.push({ id, label, description: str(r.description, LIMITS.maxDescription), reply, keywords: words(r.keywords) });
    }
  }

  const config: FollowupConfig = {
    enabled,
    mode,
    keywords: words(o.keywords),
    match_type: o.match_type === 'exact' ? 'exact' : 'contains',
    message: str(o.message, LIMITS.maxText),
    intents,
    fallback: str(o.fallback, LIMITS.maxText),
    min_confidence: Math.min(1, Math.max(0, conf)),
    max_followups: Math.min(LIMITS.maxFollowups, Math.max(1, Number.isFinite(max) ? max : 1)),
    window_hours: Math.min(LIMITS.windowHoursMax, Math.max(LIMITS.windowHoursMin, Number.isFinite(hours) ? hours : LIMITS.defaultWindowHours)),
  };
  if (enabled) {
    if (mode === 'simple' && !config.message) return { ok: false, error: 'simple_needs_message' };
    if (mode === 'ai' && !config.intents.length) return { ok: false, error: 'ai_needs_intents' };
  }
  return { ok: true, config };
}

/** A stored config (JSONB), or null when absent / disabled / broken. */
export function activeConfig(raw: unknown): FollowupConfig | null {
  if (!raw) return null;
  let v = raw;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return null; } }
  const r = normalizeFollowup(v);
  return r.ok && r.config.enabled ? r.config : null;
}

/* ------------------------------------------------------------------------ */
/* Matching and classification                                                */
/* ------------------------------------------------------------------------ */

export function matchWord(text: string, keywords: string[], matchType: 'contains' | 'exact'): string | null {
  const t = (text || '').toLowerCase().trim();
  for (const kw of keywords) {
    const k = (kw || '').toLowerCase().trim();
    if (!k) continue;
    if (matchType === 'exact' ? t === k : t.includes(k)) return kw;
  }
  return null;
}

export interface ClassifierPrompt { system: string; user: string }

/** The prompt for the LLM. It sees labels and descriptions, never the reply texts (it cannot leak or rewrite them). */
export function buildClassifierPrompt(cfg: FollowupConfig, replyText: string, context?: { firstMessage?: string }): ClassifierPrompt {
  const list = cfg.intents.map((i) => `- ${i.id}: ${i.label}${i.description ? ` (${i.description})` : ''}`).join('\n');
  const system = [
    'You classify a short Instagram direct message reply into one of a business\'s intents.',
    'The message may be in Hebrew, English or any language, may contain slang, emoji or typos.',
    'Answer with ONE JSON object and nothing else: {"intent": "<id or none>", "confidence": <0..1>}.',
    'Use only an id from the list. Use "none" when nothing fits or the message is unclear.',
    'Never write anything else: no explanations, no replies, no links.',
    '',
    'Intents:',
    list,
  ].join('\n');
  const user = [
    context?.firstMessage ? `Our previous message to them: """${context.firstMessage.slice(0, 500)}"""` : '',
    `Their reply: """${(replyText || '').slice(0, 1000)}"""`,
  ].filter(Boolean).join('\n');
  return { system, user };
}

export interface Classification { intentId: string | null; confidence: number; valid: boolean }

/**
 * Parse the LLM output strictly. Anything that is not a JSON object with a configured intent id and
 * a numeric confidence becomes "no intent". Tolerates a ```json fence, nothing else.
 */
export function parseClassification(raw: unknown, cfg: FollowupConfig): Classification {
  const none: Classification = { intentId: null, confidence: 0, valid: false };
  if (typeof raw !== 'string') return none;
  let s = raw.trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) s = fence[1].trim();
  if (!s.startsWith('{') || !s.endsWith('}')) return none;
  let obj: any;
  try { obj = JSON.parse(s); } catch { return none; }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return none;
  const id = typeof obj.intent === 'string' ? obj.intent.trim() : '';
  const conf = typeof obj.confidence === 'number' ? obj.confidence : Number.NaN;
  if (!Number.isFinite(conf) || conf < 0 || conf > 1) return none;
  if (id === 'none') return { intentId: null, confidence: conf, valid: true };
  if (!cfg.intents.some((i) => i.id === id)) return none;
  return { intentId: id, confidence: conf, valid: true };
}

export type DecisionKind = 'simple' | 'keyword' | 'intent' | 'fallback' | 'none';
export interface Decision { kind: DecisionKind; text: string | null; intentId: string | null; label: string | null; confidence: number | null; reason?: string }

/** The keyword shortcut of AI mode: an intent whose words appear in the reply wins without the LLM. */
export function keywordIntent(cfg: FollowupConfig, text: string): FollowupIntent | null {
  for (const i of cfg.intents) if (i.keywords.length && matchWord(text, i.keywords, 'contains')) return i;
  return null;
}

/**
 * Choose what to send. The returned text is ALWAYS one of the configured strings (or null).
 * `classify` is only called in AI mode when no intent keyword matched; it may throw (no key,
 * timeout), which falls back like a low-confidence answer.
 */
export async function decide(cfg: FollowupConfig, text: string, classify?: (p: ClassifierPrompt) => Promise<string>, context?: { firstMessage?: string }): Promise<Decision> {
  const clean = (text || '').trim();
  if (!clean) return { kind: 'none', text: null, intentId: null, label: null, confidence: null, reason: 'no_text' };
  if (cfg.mode === 'simple') {
    if (!cfg.keywords.length) return { kind: 'simple', text: cfg.message, intentId: null, label: null, confidence: null };
    const kw = matchWord(clean, cfg.keywords, cfg.match_type);
    return kw
      ? { kind: 'simple', text: cfg.message, intentId: null, label: kw, confidence: null }
      : { kind: 'none', text: null, intentId: null, label: null, confidence: null, reason: 'no_keyword' };
  }
  const byWord = keywordIntent(cfg, clean);
  if (byWord) return { kind: 'keyword', text: byWord.reply, intentId: byWord.id, label: byWord.label, confidence: 1 };

  let c: Classification = { intentId: null, confidence: 0, valid: false };
  let reason: string | undefined;
  if (classify) {
    try { c = parseClassification(await classify(buildClassifierPrompt(cfg, clean, context)), cfg); if (!c.valid) reason = 'invalid_output'; }
    catch (e: any) { reason = `classify_failed: ${String(e?.message || e).slice(0, 120)}`; }
  } else reason = 'no_classifier';

  if (c.intentId && c.confidence >= cfg.min_confidence) {
    const intent = cfg.intents.find((i) => i.id === c.intentId)!;
    return { kind: 'intent', text: intent.reply, intentId: intent.id, label: intent.label, confidence: c.confidence };
  }
  if (!reason) reason = c.intentId ? 'low_confidence' : 'no_intent';
  if (cfg.fallback) return { kind: 'fallback', text: cfg.fallback, intentId: c.intentId, label: null, confidence: c.valid ? c.confidence : null, reason };
  return { kind: 'none', text: null, intentId: c.intentId, label: null, confidence: c.valid ? c.confidence : null, reason };
}

/* ------------------------------------------------------------------------ */
/* Engine                                                                      */
/* ------------------------------------------------------------------------ */

export interface Conversation {
  id: string | number;
  owner_id: string;
  page_id: string;
  automation_id: string;
  recipient_id: string | null;
  /** Our first DM (ms). Only messages after it are replies to it. */
  first_dm_at: number;
  /** End of the follow-up window (ms). */
  closes_at: number;
  followups_sent: number;
  stage: 'awaiting' | 'done' | 'expired' | 'closed';
  /** The text of our first DM, given to the classifier as context. */
  first_message?: string | null;
}

export interface InboundEvent {
  pageId: string;
  /** Who wrote it. */
  senderId: string;
  mid: string;
  text: string;
  /** When they wrote it (ms). */
  createdAt: number;
  /** Meta's is_echo flag (a message the business sent). */
  isEcho?: boolean;
  source: 'webhook' | 'poll';
}

export type Outcome =
  | 'disabled' | 'echo' | 'own_message' | 'no_conversation' | 'before_first_dm' | 'duplicate'
  | 'window_closed' | 'capped' | 'no_match' | 'step_taken' | 'sent' | 'failed' | 'quota';

export interface StepRecord {
  conversation: Conversation;
  event: InboundEvent;
  decision: Decision | null;
  outcome: Outcome;
  step: number | null;
  messageId?: string | null;
  error?: string | null;
}

export interface FollowupStore {
  /** Open conversations (stage awaiting) of this page with this person, newest first. */
  openConversations(pageId: string, recipientId: string): Promise<Conversation[]>;
  /** Claim an inbound message id. false = someone already handled it (webhook vs poll). */
  claimInbound(conv: Conversation, ev: InboundEvent): Promise<boolean>;
  /** Count a reply we saw (replies_seen + last inbound time). */
  noteReply(conv: Conversation, ev: InboundEvent): Promise<void>;
  /** Atomically move followups_sent from `expected` to expected+1 if still below `max`. */
  claimStep(conv: Conversation, expected: number, max: number): Promise<boolean>;
  /** Persist the outcome (event row, log row, last bot message, stage). */
  record(r: StepRecord, cfg: FollowupConfig | null): Promise<void>;
}

export interface EngineDeps {
  store: FollowupStore;
  config(conv: Conversation): Promise<FollowupConfig | null>;
  send(conv: Conversation, recipientId: string, text: string): Promise<{ messageId: string }>;
  classify?: (p: ClassifierPrompt) => Promise<string>;
  /** Ids that are us on this page (page id, IG account id). */
  ownIds(pageId: string): Promise<Set<string>>;
  /** Owner past the monthly DM quota. */
  quotaExhausted?(ownerId: string): Promise<boolean>;
  enabled(): boolean;
  now(): number;
}

/**
 * Handle one inbound message, from the webhook or the poller. Never throws for a Meta failure:
 * the outcome says what happened and is recorded.
 */
export async function handleInbound(d: EngineDeps, ev: InboundEvent): Promise<{ outcome: Outcome; record?: StepRecord }> {
  if (!d.enabled()) return { outcome: 'disabled' };
  if (ev.isEcho) return { outcome: 'echo' };
  if (!ev.mid || !ev.senderId) return { outcome: 'no_conversation' };
  const own = await d.ownIds(ev.pageId);
  if (own.has(ev.senderId)) return { outcome: 'own_message' };

  const convs = await d.store.openConversations(ev.pageId, ev.senderId);
  // The newest conversation the message can be a reply to.
  const conv = convs.find((c) => c.stage === 'awaiting' && ev.createdAt > c.first_dm_at);
  if (!conv) return { outcome: convs.length ? 'before_first_dm' : 'no_conversation' };

  // One message, one handling, whoever saw it first.
  if (!(await d.store.claimInbound(conv, ev))) return { outcome: 'duplicate' };
  await d.store.noteReply(conv, ev);

  const now = d.now();
  const finish = async (r: Omit<StepRecord, 'conversation' | 'event'>, cfg: FollowupConfig | null) => {
    const rec: StepRecord = { conversation: conv, event: ev, ...r };
    await d.store.record(rec, cfg);
    return { outcome: rec.outcome, record: rec };
  };

  const cfg = await d.config(conv);
  if (!cfg) return finish({ decision: null, outcome: 'disabled', step: null }, null);
  if (now > conv.closes_at || now - ev.createdAt > REPLY_WINDOW_MS) return finish({ decision: null, outcome: 'window_closed', step: null }, cfg);
  if (conv.followups_sent >= cfg.max_followups) return finish({ decision: null, outcome: 'capped', step: null }, cfg);
  if (d.quotaExhausted && (await d.quotaExhausted(conv.owner_id))) return finish({ decision: null, outcome: 'quota', step: null }, cfg);

  const decision = await decide(cfg, ev.text, d.classify, { firstMessage: conv.first_message || undefined });
  if (!decision.text) return finish({ decision, outcome: 'no_match', step: null }, cfg);

  const step = conv.followups_sent;
  if (!(await d.store.claimStep(conv, step, cfg.max_followups))) return finish({ decision, outcome: 'step_taken', step: null }, cfg);
  conv.followups_sent = step + 1;
  try {
    const sent = await d.send(conv, ev.senderId, decision.text);
    return finish({ decision, outcome: 'sent', step: step + 1, messageId: sent.messageId }, cfg);
  } catch (e: any) {
    // The step stays consumed: a failed send is not retried, so a flaky Meta never doubles a reply.
    return finish({ decision, outcome: 'failed', step: step + 1, error: String(e?.message || e).slice(0, 300) }, cfg);
  }
}

/**
 * Pick the messages of a polled thread that are new replies from this person, oldest first.
 * `msgs` is Meta's list (newest first). Messages from anyone else (us, echoes) are dropped.
 */
export function newRepliesFromThread<M extends { id?: string; created_time?: string; from?: { id?: string } }>(
  msgs: M[], recipientId: string, afterMs: number,
): M[] {
  return [...msgs]
    .filter((m) => m?.id && m.from?.id === recipientId && m.created_time && Date.parse(m.created_time) > afterMs)
    .sort((a, b) => Date.parse(a.created_time!) - Date.parse(b.created_time!));
}

/** Meta's messaging webhook entries -> inbound events (Instagram). Reactions, reads and deletions are skipped. */
export function messagingEventsFrom(body: any): (InboundEvent & { accountId: string; recipientId: string })[] {
  const out: (InboundEvent & { accountId: string; recipientId: string })[] = [];
  if (!body || body.object !== 'instagram' || !Array.isArray(body.entry)) return out;
  for (const entry of body.entry) {
    for (const m of entry?.messaging || []) {
      const msg = m?.message;
      if (!msg || !msg.mid || msg.is_deleted) continue;
      out.push({
        accountId: String(entry.id || ''),
        pageId: '',
        senderId: String(m.sender?.id || ''),
        recipientId: String(m.recipient?.id || ''),
        mid: String(msg.mid),
        text: typeof msg.text === 'string' ? msg.text : '',
        createdAt: Number(m.timestamp) || Date.now(),
        isEcho: msg.is_echo === true,
        source: 'webhook',
      });
    }
  }
  return out;
}
