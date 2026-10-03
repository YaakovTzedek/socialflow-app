import { NextRequest, NextResponse } from 'next/server';
import { hasDb } from '@/lib/db';
import { getSession } from '@/lib/session';
import { listInstagramConversations, instagramConversationsForMessages, getConversationMessages, type IgConversation } from '@/lib/meta';
import { sql } from '@/lib/db';
import { resolveOwnedPage, isInbound, isStoryReply, otherParticipant, lastInboundAt, windowOpen, attachmentTypeOf } from '@/lib/inbox';

export const maxDuration = 60;

const CONVERSATIONS_LIMIT = 25;
// Enough to find the person's last message behind a few of ours, and still light.
const PREVIEW_MESSAGES = 10;
const META_CONCURRENCY = 6;

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

// GET /api/inbox?page_id=... → the page's Instagram conversations, newest first.
// Each: { id, updated_time, participant: { id, username }, last_message: { text, inbound, story, attachment, created_time }, can_reply }
export async function GET(req: NextRequest) {
  if (!hasDb) return NextResponse.json({ error: 'db_not_configured', conversations: [] }, { status: 503 });
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  const pageId = req.nextUrl.searchParams.get('page_id') || '';
  if (!pageId) return NextResponse.json({ error: 'missing_page_id' }, { status: 400 });

  try {
    const page = await resolveOwnedPage(session.userId, pageId);
    if (!page) return NextResponse.json({ error: 'page_not_found' }, { status: 404 });
    if (!page.ig_id) return NextResponse.json({ error: 'no_instagram' }, { status: 400 });

    // People SocialFlow messaged in the last 7 days come first and by direct lookup,
    // so a busy inbox whose listing times out still shows its leads.
    const sent = (await sql!`
      SELECT DISTINCT ON (l.commenter_id) l.dm_message_id
      FROM trigger_logs l JOIN automations a ON a.id = l.automation_id
      WHERE a.page_id = ${page.page_id} AND l.platform = 'instagram' AND l.dm_message_id IS NOT NULL
        AND l.created_at > now() - interval '7 days'
      ORDER BY l.commenter_id, l.created_at DESC
      LIMIT 8`).map((r: any) => String(r.dm_message_id));
    const [leadConvs, listed] = await Promise.all([
      instagramConversationsForMessages(page.page_id, page.access_token, sent),
      listInstagramConversations(page.page_id, page.access_token, CONVERSATIONS_LIMIT).catch((e) => ({ error: e as Error })),
    ]);
    if ('error' in listed && leadConvs.length === 0) throw listed.error;
    const byId = new Map<string, IgConversation>();
    for (const c of [...leadConvs, ...('error' in listed ? [] : listed)]) if (!byId.has(c.id)) byId.set(c.id, c);
    const convs = [...byId.values()].sort((x, y) => Date.parse(y.updated_time || '0') - Date.parse(x.updated_time || '0'));
    const conversations = await mapPool(convs, META_CONCURRENCY, async (c) => {
      try {
        const msgs = await getConversationMessages(c.id, page.access_token, PREVIEW_MESSAGES);
        const last = msgs[0];
        const lastIn = lastInboundAt(msgs, page.ig_id, page.page_id);
        return {
          id: c.id,
          updated_time: c.updated_time || last?.created_time || null,
          participant: otherParticipant(msgs, page.ig_id, page.page_id),
          last_message: last
            ? {
                text: (last.message || '').slice(0, 160),
                inbound: isInbound(last, page.ig_id, page.page_id),
                story: isStoryReply(last),
                attachment: attachmentTypeOf(last),
                created_time: last.created_time || null,
              }
            : null,
          last_inbound_at: lastIn ? new Date(lastIn).toISOString() : null,
          can_reply: windowOpen(lastIn),
        };
      } catch {
        return { id: c.id, updated_time: c.updated_time || null, participant: { id: null, username: null }, last_message: null, last_inbound_at: null, can_reply: false, error: true };
      }
    });
    return NextResponse.json({ conversations });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
