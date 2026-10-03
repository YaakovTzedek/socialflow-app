import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { hasDb } from '@/lib/db';
import { affiliateForOwner, joinAsAffiliate, partnerStats } from '@/lib/affiliates';

export const dynamic = 'force-dynamic';

const BASE = (process.env.NEXT_PUBLIC_BASE_URL || 'https://isocialflow.com').replace(/\/$/, '');

async function view(ownerId: string) {
  const aff = await affiliateForOwner(ownerId);
  if (!aff) return { joined: false };
  const stats = await partnerStats(aff.code);
  return { joined: true, status: aff.status, link: `${BASE}/he?aff=${aff.code}`, statsUrl: `${BASE}/he/partner/${aff.code}`, ...stats };
}

// GET /api/affiliate → the signed-in owner's partner link and numbers (or joined:false).
export async function GET() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  if (!hasDb) return NextResponse.json({ joined: false });
  try { return NextResponse.json(await view(session.userId)); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

// POST /api/affiliate → join the programme (self-serve, standard terms).
export async function POST(_req: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  if (session.impersonating) return NextResponse.json({ error: 'read_only' }, { status: 403 });
  if (!hasDb) return NextResponse.json({ error: 'db_not_configured' }, { status: 503 });
  try {
    await joinAsAffiliate(session.userId, session.userName || 'partner');
    return NextResponse.json(await view(session.userId));
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
