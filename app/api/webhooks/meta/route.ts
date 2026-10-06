import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema, hasDb } from '@/lib/db';
import { linkAdMedia } from '@/lib/ad-media';
import { verifyMetaSignature } from '@/lib/webhook-signature';
import { messagingEventsFrom } from '@/lib/followup-core';
import { handleMessagingWebhook, followupEnabled } from '@/lib/followup';
import { quotaExhaustedOwners } from '@/lib/entitlements';
import { extractCommentEvents, webhookMatches, handleMatchedComment } from '@/lib/comment-core';
import { liveCommentDeps, makeBrandingLine } from '@/lib/comment-handler';

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'socialflow_verify';

// GET — Meta webhook verification handshake
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (
    p.get('hub.mode') === 'subscribe' &&
    p.get('hub.verify_token') === VERIFY_TOKEN
  ) {
    return new NextResponse(p.get('hub.challenge') || '', { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

/**
 * Comment events. Since 6.10.2026 this runs the SAME code as the poller (lib/comment-core.ts via
 * lib/comment-handler.ts): the comment is claimed in processed_comments before any reply or DM, so
 * whichever of the two sees a comment first answers it and the other skips. Before, the webhook had
 * its own copy that never claimed (a Facebook comment could be answered twice), replied on Instagram
 * through the wrong endpoint and sent no Instagram DM.
 */
async function processEvents(body: any) {
  const events = extractCommentEvents(body);
  if (!events.length) return;
  const brandingLine = makeBrandingLine();

  for (const ev of events) {
    if (!ev.commentId) continue;
    try {
      // 5.10.2026: remember which ad media belongs to which post, so the poller reads the ad copy's comments too.
      if (ev.originalPostId && ev.postId && ev.originalPostId !== ev.postId) {
        try { await linkAdMedia(ev.originalPostId, ev.postId, 'webhook', ev.adId); } catch { /* best effort */ }
      }

      // Resolve the page token. For FB the entry id IS the page id; for IG it's the IG account id.
      const tokenRows =
        ev.platform === 'facebook'
          ? await sql!`SELECT * FROM page_tokens WHERE page_id = ${ev.pageOrIgId} LIMIT 1`
          : await sql!`SELECT * FROM page_tokens WHERE ig_id = ${ev.pageOrIgId} LIMIT 1`;
      const tokenRow = tokenRows[0];
      if (!tokenRow) continue;
      const pageToken = tokenRow.access_token as string;
      const pageId = String(tokenRow.page_id);
      const igId = (tokenRow.ig_id as string | null) || null;

      const autos = await sql!`
        SELECT * FROM automations
        WHERE page_id = ${pageId} AND platform = ${ev.platform} AND status = 'active'
        ORDER BY created_at`;
      const matches = webhookMatches(ev, autos as any[], { pageId, igId, pageName: (tokenRow.page_name as string | null) || null });
      if (!matches.length) continue;

      // Plan metering, as in the poller: an owner past this month's DM quota is not claimed, so an upgrade catches up.
      const exhausted = await quotaExhaustedOwners(matches.map((m) => String(m.automation.owner_id)));
      const deps = liveCommentDeps({ pageToken, igId, brandingLine });
      for (const m of matches) {
        if (exhausted.has(String(m.automation.owner_id))) continue;
        try {
          await handleMatchedComment(m.automation, m.comment, deps);
        } catch (e) {
          console.error('webhook comment error', m.automation.id, ev.commentId, e);
        }
      }
    } catch (e) {
      console.error('webhook comment event error', ev.commentId, e);
    }
  }
}
