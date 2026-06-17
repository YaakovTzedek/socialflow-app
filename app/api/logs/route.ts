import { NextResponse } from 'next/server';
import { sql, ensureSchema, hasDb } from '@/lib/db';
import { getSession } from '@/lib/session';

// GET /api/logs → recent automation activity for the current user
export async function GET() {
  if (!hasDb) {
    return NextResponse.json({ logs: [] });
  }
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  try {
    await ensureSchema();
    const rows = await sql!`
      SELECT l.*, a.name AS automation_name
      FROM trigger_logs l
      JOIN automations a ON a.id = l.automation_id
      WHERE a.owner_id = ${session.userId}
      ORDER BY l.created_at DESC
      LIMIT 100
    `;
    return NextResponse.json({ logs: rows });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
