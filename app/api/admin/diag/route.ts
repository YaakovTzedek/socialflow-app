import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema, hasDb } from '@/lib/db';

// Temporary diagnostic endpoint guarded by a key. Remove after debugging.
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== 'socialflow_verify_2026') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!hasDb) return NextResponse.json({ error: 'no_db' });

  await ensureSchema();
  const automations = await sql!`
    SELECT id, name, platform, page_id, page_name, post_id, post_scope,
           keywords, public_replies, dm_enabled, status, trigger_count
    FROM automations ORDER BY created_at DESC LIMIT 20`;
  const logs = await sql!`
    SELECT automation_id, platform, post_id, commenter_name, comment_text,
           matched_keyword, public_reply_status, dm_status, error_message, created_at
    FROM trigger_logs ORDER BY created_at DESC LIMIT 30`;
  const pageTokens = await sql!`
    SELECT page_id, page_name, ig_id,
           (access_token IS NOT NULL) AS has_token, updated_at
    FROM page_tokens ORDER BY updated_at DESC LIMIT 20`;

  return NextResponse.json({
    automations_count: automations.length,
    automations,
    logs_count: logs.length,
    logs,
    page_tokens: pageTokens,
  });
}
