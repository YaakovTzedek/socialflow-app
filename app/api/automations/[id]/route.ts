import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema, hasDb } from '@/lib/db';
import { getSession } from '@/lib/session';
import { automationActivationBlock } from '@/lib/entitlements';

// PATCH /api/automations/:id → update status (active/paused) or fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!hasDb) return NextResponse.json({ error: 'db_not_configured' }, { status: 503 });
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  try {
    await ensureSchema();
    const body = await req.json();
    const EDITABLE = [
      'name', 'keywords', 'match_type', 'public_reply_enabled', 'public_replies',
      'dm_enabled', 'dm_message', 'dm_link', 'once_per_user', 'status',
    ] as const;
    const patch: Record<string, unknown> = {};
    for (const k of EDITABLE) if (k in body) patch[k] = body[k];
    if (typeof patch.name === 'string' && !patch.name.trim()) delete patch.name;
    if (patch.status && !['active', 'paused'].includes(String(patch.status))) delete patch.status;
    if (patch.match_type && !['contains', 'exact'].includes(String(patch.match_type))) delete patch.match_type;
    if ('keywords' in patch) patch.keywords = Array.isArray(patch.keywords) ? patch.keywords.map((k: unknown) => String(k).trim()).filter(Boolean) : [];
    if ('public_replies' in patch) patch.public_replies = Array.isArray(patch.public_replies) ? patch.public_replies.map((k: unknown) => String(k).trim()).filter(Boolean) : [];
    if (patch.public_reply_enabled) {
      // A story-reply automation has no comment to answer publicly.
      const [cur] = await sql!`SELECT post_scope FROM automations WHERE id = ${params.id} AND owner_id = ${session.userId}`;
      if (cur?.post_scope === 'story_replies') patch.public_reply_enabled = false;
    }
    if (patch.status === 'active') {
      const block = await automationActivationBlock(session.userId, params.id);
      if (block) return NextResponse.json({ error: 'plan_limit', reason: block.reason, limit: block.limit, plan: block.plan }, { status: 402 });
    }
    if (Object.keys(patch).length) {
      await sql!`
        UPDATE automations SET ${sql!(patch as any, ...Object.keys(patch))}
        WHERE id = ${params.id} AND owner_id = ${session.userId}
      `;
    }
    const [row] = await sql!`SELECT * FROM automations WHERE id = ${params.id} AND owner_id = ${session.userId}`;
    return NextResponse.json({ success: true, automation: row || null });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/automations/:id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!hasDb) return NextResponse.json({ error: 'db_not_configured' }, { status: 503 });
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  try {
    await ensureSchema();
    await sql!`
      DELETE FROM automations
      WHERE id = ${params.id} AND owner_id = ${session.userId}
    `;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
