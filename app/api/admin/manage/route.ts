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
    SELECT id, name, platform, post_id, keywords, public_replies,
           dm_enabled, dm_message, status, trigger_count, created_at
    FROM automations ORDER BY created_at DESC`;
  return NextResponse.json({ automations: rows });
}

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== KEY)
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!hasDb) return NextResponse.json({ error: 'no_db' });
  await ensureSchema();
  const { action, id, dm_message, public_replies } = await req.json();
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
