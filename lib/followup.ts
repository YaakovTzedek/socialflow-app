/**
 * Continued DM conversation: the Postgres + Graph API + LLM side of lib/followup-core.ts.
 *
 * Gating (6.10.2026):
 *   - FOLLOWUP_ENABLED=true is the global switch. Unset = the feature is dormant: no conversation is
 *     opened, the poller does not read inboxes, the webhook ignores messages. Configs can still be saved.
 *   - AI mode needs the plan capability limits.aiFollowup (Pro / Agency, everyone while CLOSED_BETA=true),
 *     or the owner listed in FOLLOWUP_BETA_OWNERS (comma separated owner ids). Simple mode needs only the switch.
 *   - Reading and answering DMs needs instagram_manage_messages; until Meta's App Review approves it,
 *     only people with a role on the Meta app (testers) can be read and answered.
 */
import { sql, ensureSchema } from './db';
import { getEntitlement, quotaExhaustedOwners } from './entitlements';
import { graphGet, getConversationMessages, sendInstagramMessage } from './meta';
import { classifyWithLlm, llmProvider } from './llm';
import {
  activeConfig, handleInbound, newRepliesFromThread,
  type Conversation, type EngineDeps, type FollowupConfig, type FollowupStore, type InboundEvent, type StepRecord,
} from './followup-core';

export function followupEnabled(): boolean {
  return process.env.FOLLOWUP_ENABLED === 'true';
}

function betaOwners(): Set<string> {
  return new Set((process.env.FOLLOWUP_BETA_OWNERS || '').split(',').map((s) => s.trim()).filter(Boolean));
}

export interface FollowupCapability { enabled: boolean; ai: boolean; llm: 'openrouter' | 'openai' | 'anthropic' | null; beta: true }

export async function followupCapability(ownerId: string): Promise<FollowupCapability> {
  let ai = betaOwners().has(ownerId);
  if (!ai) { try { ai = (await getEntitlement(ownerId)).plan.limits.aiFollowup; } catch { ai = false; } }
  return { enabled: followupEnabled(), ai, llm: llmProvider(), beta: true };
}

const toConv = (r: any): Conversation => ({
  id: r.id,
  owner_id: r.owner_id,
  page_id: r.page_id,
  automation_id: r.automation_id,
  recipient_id: r.recipient_id,
  first_dm_at: new Date(r.first_dm_at).getTime(),
  closes_at: new Date(r.closes_at).getTime(),
  followups_sent: Number(r.followups_sent) || 0,
  stage: r.stage,
  first_message: r.first_message ?? null,
});

/**
 * Called right after an automation's first private message went out. Opens the follow-up window for
 * that person when the automation has an active follow-up step. Never throws (it must not break a send).
 */
export async function openFollowupConversation(opts: {
  automation: any;
  recipientId?: string | null;
  recipientName?: string | null;
  firstDmMid: string | null;
  logId?: number | string | null;
}): Promise<void> {
  try {
    if (!followupEnabled()) return;
    const a = opts.automation;
    if (a.platform !== 'instagram') return; // v1: Instagram DMs only.
    const cfg = activeConfig(a.followup);
    if (!cfg) return;
    if (cfg.mode === 'ai' && !(await followupCapability(a.owner_id)).ai) return;
    const key = opts.recipientId ? String(opts.recipientId) : opts.firstDmMid ? `mid:${opts.firstDmMid}` : null;
    if (!key) return;
    const closes = new Date(Date.now() + cfg.window_hours * 3600_000);
    await sql!`
      INSERT INTO followup_conversations (owner_id, page_id, automation_id, recipient_key, recipient_id, recipient_name,
        source_log_id, first_dm_mid, first_dm_at, closes_at)
      VALUES (${a.owner_id}, ${a.page_id}, ${a.id}, ${key}, ${opts.recipientId || null}, ${opts.recipientName || null},
        ${opts.logId != null ? Number(opts.logId) : null}, ${opts.firstDmMid}, now(), ${closes})
      ON CONFLICT (automation_id, recipient_key) DO NOTHING`;
  } catch (e) {
    console.error('followup open failed', (e as Error).message);
  }
}

/* ------------------------------------------------------------------------ */
/* Store (Postgres)                                                           */
/* ------------------------------------------------------------------------ */

export const pgStore: FollowupStore = {
  async openConversations(pageId, recipientId) {
    const rows = await sql!`
      SELECT c.*, a.dm_message AS first_message FROM followup_conversations c
      JOIN automations a ON a.id = c.automation_id AND a.status = 'active'
      WHERE c.page_id = ${pageId} AND c.recipient_id = ${recipientId} AND c.stage = 'awaiting'
      ORDER BY c.first_dm_at DESC LIMIT 5`;
    return rows.map(toConv);
  },
  async claimInbound(conv, ev) {
    const r = await sql!`
      INSERT INTO followup_events (inbound_mid, conversation_id, source, inbound_text, inbound_at)
      VALUES (${ev.mid}, ${Number(conv.id)}, ${ev.source}, ${(ev.text || '').slice(0, 2000)}, ${new Date(ev.createdAt)})
      ON CONFLICT (inbound_mid) DO NOTHING RETURNING inbound_mid`;
    return r.length > 0;
  },
  async noteReply(conv, ev) {
    await sql!`
      UPDATE followup_conversations SET replies_seen = replies_seen + 1,
        last_inbound_at = GREATEST(COALESCE(last_inbound_at, ${new Date(ev.createdAt)}), ${new Date(ev.createdAt)}), updated_at = now()
      WHERE id = ${Number(conv.id)}`;
  },
  async claimStep(conv, expected, max) {
    const r = await sql!`
      UPDATE followup_conversations SET followups_sent = followups_sent + 1, updated_at = now()
      WHERE id = ${Number(conv.id)} AND followups_sent = ${expected} AND followups_sent < ${max} AND stage = 'awaiting'
      RETURNING id`;
    return r.length > 0;
  },
  async record(r, cfg) {
    await recordStep(r, cfg);
  },
};

async function recordStep(r: StepRecord, cfg: FollowupConfig | null) {
  const c = r.conversation;
  const d = r.decision;
  await sql!`
    UPDATE followup_events SET outcome = ${r.outcome}, decision = ${d?.kind || null}, intent = ${d?.label || d?.intentId || null},
      confidence = ${d?.confidence ?? null}, step = ${r.step}, reply_mid = ${r.messageId || null},
      error = ${r.error || d?.reason || null}
    WHERE inbound_mid = ${r.event.mid}`;
  if (r.outcome === 'sent' || r.outcome === 'failed') {
    const done = cfg ? c.followups_sent >= cfg.max_followups : true;
    await sql!`
      UPDATE followup_conversations SET
        last_bot_mid = COALESCE(${r.messageId || null}, last_bot_mid),
        last_bot_at = CASE WHEN ${r.outcome === 'sent'} THEN now() ELSE last_bot_at END,
        last_error = ${r.error || null},
        stage = CASE WHEN ${done} THEN 'done' ELSE stage END, updated_at = now()
      WHERE id = ${Number(c.id)}`;
    // The activity log + monthly DM quota count follow-ups like any other private message. Never retried
    // by the DM retry pass (dm_retryable false, followup_step set), so a failure cannot turn into a double send.
    await sql!`
      INSERT INTO trigger_logs (automation_id, platform, post_id, comment_id, commenter_id, commenter_name, comment_text,
        matched_keyword, public_reply_status, dm_status, error_message, dm_message_id, dm_attempts, dm_retryable, followup_step)
      SELECT ${c.automation_id}, 'instagram', NULL, ${r.event.mid}, ${r.event.senderId}, fc.recipient_name, ${(r.event.text || '').slice(0, 2000)},
        ${`↩ ${d?.label || d?.kind || 'followup'}`}, 'skipped', ${r.outcome === 'sent' ? 'sent' : 'failed'}, ${r.error || null},
        ${r.messageId || null}, 1, false, ${r.step}
      FROM followup_conversations fc WHERE fc.id = ${Number(c.id)}`;
  } else if (r.outcome === 'capped') {
    await sql!`UPDATE followup_conversations SET stage = 'done', updated_at = now() WHERE id = ${Number(c.id)}`;
  } else if (r.outcome === 'window_closed') {
    await sql!`UPDATE followup_conversations SET stage = 'expired', updated_at = now() WHERE id = ${Number(c.id)} AND closes_at < now()`;
  }
}

/* ------------------------------------------------------------------------ */
/* Engine wiring                                                              */
/* ------------------------------------------------------------------------ */

interface PageRow { page_id: string; access_token: string; ig_id: string | null }

function engineDeps(page: PageRow): EngineDeps {
  return {
    store: pgStore,
    enabled: followupEnabled,
    now: () => Date.now(),
    async config(conv) {
      const [a] = await sql!`SELECT followup, owner_id, status FROM automations WHERE id = ${conv.automation_id}`;
      if (!a || a.status !== 'active') return null;
      const cfg = activeConfig(a.followup);
      if (cfg?.mode === 'ai' && !(await followupCapability(a.owner_id)).ai) return null;
      return cfg;
    },
    async ownIds() {
      return new Set([page.page_id, page.ig_id].filter(Boolean) as string[]);
    },
    async quotaExhausted(ownerId) {
      return (await quotaExhaustedOwners([ownerId])).has(ownerId);
    },
    send: (_conv, recipientId, text) => sendInstagramMessage(recipientId, text, page.access_token),
    classify: classifyWithLlm,
  };
}

/** Webhook: Meta's messaging events for Instagram. The caller has already verified the signature. */
export async function handleMessagingWebhook(body: any, events: (InboundEvent & { accountId: string })[]): Promise<{ handled: number; outcomes: string[] }> {
  const outcomes: string[] = [];
  if (!followupEnabled() || !events.length) return { handled: 0, outcomes };
  await ensureSchema();
  void body;
  for (const ev of events) {
    const [page] = await sql!`SELECT page_id, access_token, ig_id FROM page_tokens WHERE ig_id = ${ev.accountId} LIMIT 1`;
    if (!page) { outcomes.push('no_page'); continue; }
    try {
      const r = await handleInbound(engineDeps(page as any), { ...ev, pageId: String(page.page_id) });
      outcomes.push(r.outcome);
    } catch (e: any) {
      outcomes.push(`error: ${String(e?.message || e).slice(0, 80)}`);
    }
  }
  return { handled: events.length, outcomes };
}

const POLL_BATCH = 30;
const POLL_CONCURRENCY = 3;
/** A conversation is re-read at most this often (the cron runs every 2 minutes). */
const POLL_EVERY_SECONDS = 90;

/**
 * Poller pass: read only the threads of people inside an open follow-up window (never the whole inbox),
 * oldest-polled first, at most POLL_BATCH per run. Expired windows are closed first.
 */
export async function pollFollowups(budgetEndsAt: number): Promise<any> {
  if (!followupEnabled()) return { skipped: 'disabled' };
  await ensureSchema();
  await sql!`UPDATE followup_conversations SET stage = 'expired', updated_at = now() WHERE stage = 'awaiting' AND closes_at < now()`;
  const rows = await sql!`
    SELECT c.*, t.access_token, t.ig_id AS page_ig_id
    FROM followup_conversations c
    JOIN automations a ON a.id = c.automation_id AND a.status = 'active'
    JOIN page_tokens t ON t.page_id = c.page_id
    WHERE c.stage = 'awaiting' AND c.closes_at > now()
      AND (c.last_polled_at IS NULL OR c.last_polled_at < now() - make_interval(secs => ${POLL_EVERY_SECONDS}))
    ORDER BY c.last_polled_at NULLS FIRST, c.id
    LIMIT ${POLL_BATCH}`;
  const stats = { conversations: rows.length, replies: 0, sent: 0, errors: 0 } as Record<string, number>;
  let next = 0;
  const work = async () => {
    while (next < rows.length) {
      const r: any = rows[next++];
      if (Date.now() > budgetEndsAt) return;
      const page: PageRow = { page_id: r.page_id, access_token: r.access_token, ig_id: r.page_ig_id };
      try {
        let recipient: string | null = r.recipient_id;
        if (!recipient && r.first_dm_mid) {
          // Our private reply's recipient (IGSID), read from the message we sent.
          const m = await graphGet<{ to?: { data?: { id: string; username?: string }[] } }>(r.first_dm_mid, { fields: 'to', access_token: page.access_token });
          const to = m.to?.data?.find((x) => x.id !== page.ig_id && x.id !== page.page_id);
          if (to?.id) {
            recipient = to.id;
            const moved = await sql!`
              UPDATE followup_conversations SET recipient_id = ${recipient}, recipient_key = ${recipient},
                recipient_name = COALESCE(recipient_name, ${to.username || null}), updated_at = now()
              WHERE id = ${r.id} AND NOT EXISTS (
                SELECT 1 FROM followup_conversations o WHERE o.automation_id = ${r.automation_id} AND o.recipient_key = ${recipient})
              RETURNING id`;
            if (!moved.length) {
              // The same person already has a conversation on this automation: this one is a duplicate.
              await sql!`UPDATE followup_conversations SET stage = 'closed', recipient_id = ${recipient}, updated_at = now() WHERE id = ${r.id}`;
              continue;
            }
          }
        }
        if (!recipient) { await sql!`UPDATE followup_conversations SET last_polled_at = now(), last_error = 'recipient_unknown' WHERE id = ${r.id}`; continue; }

        let convId: string | null = r.ig_conversation_id;
        if (!convId) {
          const c = await graphGet<{ data: { id: string }[] }>(`${page.page_id}/conversations`, {
            platform: 'instagram', user_id: recipient, fields: 'id', access_token: page.access_token,
          });
          convId = c.data?.[0]?.id || null;
          if (convId) await sql!`UPDATE followup_conversations SET ig_conversation_id = ${convId} WHERE id = ${r.id}`;
        }
        if (!convId) { await sql!`UPDATE followup_conversations SET last_polled_at = now(), last_error = 'conversation_not_found' WHERE id = ${r.id}`; continue; }

        const msgs = await getConversationMessages(convId, page.access_token, 10);
        const after = Math.max(new Date(r.first_dm_at).getTime(), r.last_inbound_at ? new Date(r.last_inbound_at).getTime() - 1 : 0);
        const replies = newRepliesFromThread(msgs, recipient, after);
        const deps = engineDeps(page);
        for (const m of replies) {
          stats.replies++;
          const out = await handleInbound(deps, {
            pageId: page.page_id, senderId: recipient, mid: m.id, text: m.message || '',
            createdAt: Date.parse(m.created_time!), source: 'poll',
          });
          if (out.outcome === 'sent') stats.sent++;
        }
        await sql!`UPDATE followup_conversations SET last_polled_at = now(), last_error = NULL WHERE id = ${r.id}`;
      } catch (e: any) {
        stats.errors++;
        await sql!`UPDATE followup_conversations SET last_polled_at = now(), last_error = ${String(e?.message || e).slice(0, 300)} WHERE id = ${r.id}`.catch(() => {});
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(POLL_CONCURRENCY, rows.length) }, work));
  return stats;
}

/** Conversation states + their events, for the automation's activity view and MCP. */
export async function followupConversations(ownerId: string, automationId: string, limit = 30) {
  await ensureSchema();
  const convs = await sql!`
    SELECT c.id, c.recipient_name, c.recipient_id, c.stage, c.replies_seen, c.followups_sent, c.first_dm_at, c.closes_at,
           c.last_inbound_at, c.last_bot_at, c.last_error
    FROM followup_conversations c JOIN automations a ON a.id = c.automation_id
    WHERE c.automation_id = ${automationId} AND a.owner_id = ${ownerId}
    ORDER BY c.first_dm_at DESC LIMIT ${Math.min(100, Math.max(1, limit))}`;
  const ids = convs.map((c: any) => Number(c.id));
  const events = ids.length
    ? await sql!`
        SELECT conversation_id, source, inbound_text, inbound_at, outcome, decision, intent, confidence, step, error, created_at
        FROM followup_events WHERE conversation_id = ANY(${ids}) ORDER BY created_at ASC`
    : [];
  const byConv = new Map<number, any[]>();
  for (const e of events as any[]) {
    const list = byConv.get(Number(e.conversation_id)) || [];
    list.push(e);
    byConv.set(Number(e.conversation_id), list);
  }
  return convs.map((c: any) => ({ ...c, events: byConv.get(Number(c.id)) || [] }));
}
