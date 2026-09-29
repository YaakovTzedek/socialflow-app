import { NextRequest, NextResponse } from 'next/server';
import { hasDb } from '@/lib/db';
import { isAdminRequest, isOwnerRequest } from '@/lib/admin';
import { customerDetail } from '@/lib/admin-customers';

export const dynamic = 'force-dynamic';

/** One account: summary, timeline, automations, pages, MCP keys, billing. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!hasDb) return NextResponse.json({ error: 'db_not_configured' }, { status: 503 });
  if (!/^[0-9]{3,40}$/.test(params.id)) return NextResponse.json({ error: 'bad_id' }, { status: 400 });
  try {
    const [detail, owner] = await Promise.all([customerDetail(params.id), isOwnerRequest()]);
    if (!detail) return NextResponse.json({ error: 'customer_not_found' }, { status: 404 });
    return NextResponse.json({ ...detail, canImpersonate: owner });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
