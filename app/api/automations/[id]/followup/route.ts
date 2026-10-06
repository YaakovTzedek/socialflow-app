import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema, hasDb } from '@/lib/db';
import { getSession } from '@/lib/session';
import { blockIfImpersonating } from '@/lib/impersonation';
import { recordEvent } from '@/lib/audit';
import { normalizeFollowup } from '@/lib/followup-core';
import { followupCapability, followupConversations } from '@/lib/followup';

/**
 * The follow-up step of one automation (continued DM conversation, beta, 6.10.2026).
 * GET  → { followup, capability, conversations }   (conversation states + their events, for the activity view)
 * PUT  { followup: {...} | null } → saves (null removes it). AI mode needs the ai_followup capability (402 otherwise).
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!hasDb) return NextResponse.json({ error: 'db_not_configured' }, { status: 503 });
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  try {
    await ensureSchema();
    const [row] = await sql!`SELECT id, platform, followup FROM automations WHERE id = ${params.id} AND owner_id = ${session.userId}`;
    if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    const [capability, conversations] = await Promise.all([
      followupCapability(session.userId),
      followupConversations(session.userId, params.id, 30),
    ]);
    return NextResponse.json({ followup: row.followup || null, platform: row.platform, capability, conversations });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const blocked = await blockIfImpersonating('automation_update');
  if (blocked) return blocked;
  if (!hasDb) return NextResponse.json({ error: 'db_not_configured' }, { status: 503 });
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  try {
    await ensureSchema();
    const body = await req.json().catch(() => ({}));
    const [row] = await sql!`SELECT id, name, platform FROM automations WHERE id = ${params.id} AND owner_id = ${session.userId}`;
    if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    let value: any = null;
    if (body?.followup != null) {
      if (row.platform !== 'instagram') return NextResponse.json({ error: 'instagram_only' }, { status: 400 });
      const r = normalizeFollowup(body.followup);
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
      if (r.config.mode === 'ai' && r.config.enabled && !(await followupCapability(session.userId)).ai) {
        return NextResponse.json({ error: 'plan_limit', reason: 'ai_followup' }, { status: 402 });
      }
      value = r.config;
    }
    await sql!`UPDATE automations SET followup = ${value ? sql!.json(value) : null} WHERE id = ${params.id} AND owner_id = ${session.userId}`;
    await recordEvent(session.userId, 'automation_updated', { id: params.id, name: row.name, fields: ['followup'], mode: value?.mode ?? null });
    return NextResponse.json({ success: true, followup: value });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
