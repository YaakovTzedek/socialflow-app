import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { hasDb } from '@/lib/db';
import { getBrain, getSegment, setSegment, getSegmentBenchmark, isSegment } from '@/lib/brain';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  if (!hasDb) return NextResponse.json({ error: 'db_not_configured' }, { status: 503 });
  const dParam = Number(req.nextUrl.searchParams.get('days'));
  const days = [7, 30, 90].includes(dParam) ? dParam : 30;
  const tz = req.nextUrl.searchParams.get('tz') || 'UTC';
  const [data, segment] = await Promise.all([getBrain(session.userId, days, tz), getSegment(session.userId)]);
  const benchmark = await getSegmentBenchmark(segment);
  return NextResponse.json({ ...data, segment, benchmark });
}

/** Set the account's segment, which is what the cross-account benchmark keys on. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  if (!hasDb) return NextResponse.json({ error: 'db_not_configured' }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  if (!isSegment(body.segment)) return NextResponse.json({ error: 'bad_segment' }, { status: 400 });
  await setSegment(session.userId, body.segment);
  const benchmark = await getSegmentBenchmark(body.segment);
  return NextResponse.json({ ok: true, segment: body.segment, benchmark });
}
