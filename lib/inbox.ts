/**
 * Shared pieces of the Instagram DM inbox (/api/inbox) and the story-reply
 * pass of the poller: page ownership, message direction and the 24 hour rule.
 */
import { sql, ensureSchema } from './db';
import { listPages, type IgMessage } from './meta';
import { requireUserToken } from './auth-helpers';

/** Meta only accepts a reply within 24 hours of the user's last message. */
export const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface OwnedPage { page_id: string; access_token: string; ig_id: string | null; page_name: string | null }

/**
 * The page's stored token, only if the page belongs to this user
 * (page_tokens.owner_id). A page that is not stored yet is looked up once
 * through the user's own Meta token and stored, the same heal /api/pages does.
 */
export async function resolveOwnedPage(ownerId: string, pageId: string): Promise<OwnedPage | null> {
  await ensureSchema();
  const [row] = await sql!`
    SELECT page_id, access_token, ig_id, page_name FROM page_tokens
    WHERE page_id = ${pageId} AND owner_id = ${ownerId} LIMIT 1`;
  if (row) return row as unknown as OwnedPage;
  const userToken = await requireUserToken();
  if (!userToken) return null;
  const page = (await listPages(userToken)).find((p) => p.id === pageId);
  if (!page?.access_token) return null;
  const igId = page.instagram_business_account?.id ?? null;
  await sql!`
    INSERT INTO page_tokens (page_id, owner_id, page_name, access_token, ig_id)
    VALUES (${page.id}, ${ownerId}, ${page.name ?? null}, ${page.access_token}, ${igId})
    ON CONFLICT (page_id) DO UPDATE SET
      owner_id = EXCLUDED.owner_id, page_name = EXCLUDED.page_name,
      access_token = EXCLUDED.access_token, ig_id = EXCLUDED.ig_id, updated_at = now()`;
  return { page_id: page.id, access_token: page.access_token, ig_id: igId, page_name: page.name ?? null };
}

/** Inbound = written by the other person, not by the business account. */
export function isInbound(msg: IgMessage, igId: string | null, pageId: string): boolean {
  const from = msg.from?.id;
  if (!from) return false;
  return from !== igId && from !== pageId;
}

/**
 * A reply to one of our Stories. Meta puts a `story` object on the message
 * (story.reply_to); a Story *mention* carries story.mention instead and is
 * not a reply, so it is left out.
 */
export function isStoryReply(msg: IgMessage): boolean {
  const s: any = msg.story;
  if (!s || typeof s !== 'object') return false;
  return !(s.mention && !s.reply_to);
}

/** The story id a message replies to, when Meta gives one. */
export function storyIdOf(msg: IgMessage): string | null {
  const s: any = msg.story;
  return s?.reply_to?.id || s?.mention?.id || s?.id || null;
}

/** The first attachment's kind: image, video, audio, file, or null. */
export function attachmentTypeOf(msg: IgMessage): string | null {
  const a = msg.attachments?.data?.[0];
  if (!a) return null;
  if (a.image_data) return 'image';
  if (a.video_data) return 'video';
  const mime = a.mime_type || '';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return a.type || 'file';
}

/** The other participant of a conversation, read from its messages. */
export function otherParticipant(msgs: IgMessage[], igId: string | null, pageId: string): { id: string | null; username: string | null } {
  for (const m of msgs) {
    if (isInbound(m, igId, pageId)) return { id: m.from?.id || null, username: m.from?.username || m.from?.name || null };
  }
  for (const m of msgs) {
    const to = m.to?.data?.find((x) => x.id !== igId && x.id !== pageId);
    if (to) return { id: to.id, username: to.username || to.name || null };
  }
  return { id: null, username: null };
}

/** Newest inbound message time (ms) in a list, or null. */
export function lastInboundAt(msgs: IgMessage[], igId: string | null, pageId: string): number | null {
  let best: number | null = null;
  for (const m of msgs) {
    if (!isInbound(m, igId, pageId) || !m.created_time) continue;
    const t = Date.parse(m.created_time);
    if (!Number.isNaN(t) && (best === null || t > best)) best = t;
  }
  return best;
}

export function windowOpen(lastInbound: number | null): boolean {
  return lastInbound !== null && Date.now() - lastInbound < REPLY_WINDOW_MS;
}
