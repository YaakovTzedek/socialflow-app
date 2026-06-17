import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema, hasDb } from '@/lib/db';
import { getSession } from '@/lib/session';

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
    if (body.status) {
      await sql!`
        UPDATE automations SET status = ${body.status}
        WHERE id = ${params.id} AND owner_id = ${session.userId}
      `;
    }
    return NextResponse.json({ success: true });
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
