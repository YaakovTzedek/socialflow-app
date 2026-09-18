import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema, hasDb } from '@/lib/db';

/** GET /api/admin/logs?key=... — recent trigger rows, so a failed reply/DM can be diagnosed. */
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== 'socialflow_verify_2026') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!hasDb) return NextResponse.json({ error: 'no_db' }, { status: 503 });
  await ensureSchema();
  const rows = await sql!`
    SELECT t.created_at, a.name, t.platform, t.comment_text, t.commenter_name,
           t.matched_keyword, t.public_reply_status, t.dm_status, t.error_message
    FROM trigger_logs t LEFT JOIN automations a ON a.id = t.automation_id
    ORDER BY t.created_at DESC LIMIT 25`;
  return NextResponse.json({ rows });
}
