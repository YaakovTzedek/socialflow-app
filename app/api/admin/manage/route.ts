import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema, hasDb } from '@/lib/db';

const KEY = 'socialflow_verify_2026';

// GET  /api/admin/manage?key=  → full automation details
// POST /api/admin/manage?key=  { action:'delete', id }  → delete an automation
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== KEY)
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!hasDb) return NextResponse.json({ error: 'no_db' });
  await ensureSchema();
  const rows = await sql!`
    SELECT id, name, platform, page_id, ig_id, owner_id, post_id, keywords, public_replies, dm_link,
           dm_enabled, dm_message, status, trigger_count, created_at
    FROM automations ORDER BY created_at DESC`;
  return NextResponse.json({ automations: rows });
}

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== KEY)
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!hasDb) return NextResponse.json({ error: 'no_db' });
  await ensureSchema();
  const { action, id, dm_message, public_replies, page_id, from_page, to_page, automation_id, commenters, comment_id, comment_time } = await req.json();
  // 30.9.2026: automations created with the old Reelsi page id failed every DM (token of another page). Move them.
  if (action === 'move_page' && from_page && to_page) {
    const rows = await sql!`UPDATE automations SET page_id = ${String(to_page)} WHERE page_id = ${String(from_page)} RETURNING id, name`;
    return NextResponse.json({ ok: true, moved: rows });
  }
  // Queue failed DMs of given commenters for one more retry on the next poll (after fixing their automation).
  if (action === 'retry_dm' && automation_id && Array.isArray(commenters) && commenters.length) {
    const rows = await sql!`UPDATE trigger_logs SET dm_attempts = 0, dm_retryable = true, created_at = now()
      WHERE automation_id = ${String(automation_id)} AND dm_status = 'failed' AND commenter_name = ANY(${commenters.map(String)})
      RETURNING id, commenter_name`;
    return NextResponse.json({ ok: true, queued: rows });
  }
  // 1.10.2026: an automation added AFTER comments already came in (an ad post) baselines them on purpose.
  // Re-open exactly one comment: move the automation's start to just before it and forget the baseline row.
  if (action === 'reopen_comment' && automation_id && comment_id && comment_time) {
    const t = new Date(Date.parse(String(comment_time)) - 60_000).toISOString();
    const a = await sql!`UPDATE automations SET created_at = ${t} WHERE id = ${String(automation_id)} RETURNING id, name, created_at`;
    const d = await sql!`DELETE FROM processed_comments WHERE automation_id = ${String(automation_id)} AND comment_id = ${String(comment_id)} RETURNING comment_id`;
    return NextResponse.json({ ok: true, automation: a, unbaselined: d });
  }
  if (action === 'delete') {
    await sql!`DELETE FROM automations WHERE id = ${id}`;
    await sql!`DELETE FROM processed_comments WHERE automation_id = ${id}`;
    return NextResponse.json({ success: true, deleted: id });
  }
  if (action === 'update_dm') {
    await sql!`UPDATE automations SET dm_message = ${dm_message} WHERE id = ${id}`;
    return NextResponse.json({ success: true, updated: id });
  }
  // Change what an automation answers, without re-answering comments it already handled.
  if (action === 'update_replies' && Array.isArray(public_replies) && public_replies.length) {
    await sql!`UPDATE automations SET public_replies = ${public_replies.map(String)} WHERE id = ${id}`;
    if (typeof dm_message === 'string' && dm_message) await sql!`UPDATE automations SET dm_message = ${dm_message} WHERE id = ${id}`;
    return NextResponse.json({ success: true, updated: id });
  }
  return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
}
