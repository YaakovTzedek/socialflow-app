import { NextRequest, NextResponse } from 'next/server';
import { hasDb } from '@/lib/db';
import { getSession } from '@/lib/session';
import { getConversationMessages, sendInstagramMessage } from '@/lib/meta';
import { resolveOwnedPage, isInbound, isStoryReply, storyIdOf, otherParticipant, lastInboundAt, windowOpen, attachmentTypeOf } from '@/lib/inbox';

export const maxDuration = 30;

const THREAD_MESSAGES = 30;
const MAX_TEXT = 1000; // Instagram's DM text limit

async function load(req: NextRequest, conversationId: string) {
  if (!hasDb) return { res: NextResponse.json({ error: 'db_not_configured' }, { status: 503 }) };
  const session = await getSession();
  if (!session.userId) return { res: NextResponse.json({ error: 'not_authenticated' }, { status: 401 }) };
  const pageId = req.nextUrl.searchParams.get('page_id') || '';
  if (!pageId || !conversationId) return { res: NextResponse.json({ error: 'missing_fields' }, { status: 400 }) };
  const page = await resolveOwnedPage(session.userId, pageId);
  if (!page) return { res: NextResponse.json({ error: 'page_not_found' }, { status: 404 }) };
  // The conversation is read with this page's own token, so a conversation of
  // another page is refused by Meta rather than shown.
  const msgs = await getConversationMessages(conversationId, page.access_token, THREAD_MESSAGES);
  return { page, msgs };
}

// GET /api/inbox/:conversationId?page_id=... → messages oldest first.
// { participant, can_reply, last_inbound_at, messages: [{ id, created_time, direction: 'in'|'out', text, story, story_id, attachment }] }
export async function GET(req: NextRequest, { params }: { params: { conversationId: string } }) {
  try {
    const r = await load(req, params.conversationId);
    if ('res' in r) return r.res;
    const { page, msgs } = r;
    const lastIn = lastInboundAt(msgs, page.ig_id, page.page_id);
    const messages = [...msgs].reverse().map((m) => ({
      id: m.id,
      created_time: m.created_time || null,
      direction: isInbound(m, page.ig_id, page.page_id) ? 'in' : 'out',
      text: m.message || '',
      story: isStoryReply(m),
      story_id: storyIdOf(m),
      attachment: attachmentTypeOf(m),
    }));
    return NextResponse.json({
      participant: otherParticipant(msgs, page.ig_id, page.page_id),
      can_reply: windowOpen(lastIn),
      last_inbound_at: lastIn ? new Date(lastIn).toISOString() : null,
      messages,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}

// POST /api/inbox/:conversationId?page_id=...  { text } → send a DM to the other participant.
// 409 { error: 'window_closed' } when their last message is older than 24 hours.
export async function POST(req: NextRequest, { params }: { params: { conversationId: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const text = String(body?.text || '').trim();
    if (!text) return NextResponse.json({ error: 'empty_text' }, { status: 400 });
    if (text.length > MAX_TEXT) return NextResponse.json({ error: 'text_too_long', max: MAX_TEXT }, { status: 400 });

    const r = await load(req, params.conversationId);
    if ('res' in r) return r.res;
    const { page, msgs } = r;
    const lastIn = lastInboundAt(msgs, page.ig_id, page.page_id);
    if (!windowOpen(lastIn)) return NextResponse.json({ error: 'window_closed' }, { status: 409 });
    const recipient = otherParticipant(msgs, page.ig_id, page.page_id).id;
    if (!recipient) return NextResponse.json({ error: 'no_recipient' }, { status: 400 });

    const sent = await sendInstagramMessage(recipient, text, page.access_token);
    return NextResponse.json({
      success: true,
      message: { id: sent.messageId, created_time: new Date().toISOString(), direction: 'out', text, story: false, story_id: null, attachment: null },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
