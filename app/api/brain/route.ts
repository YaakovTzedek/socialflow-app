import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { hasDb } from '@/lib/db';
import { getBrain, getSegment, setSegment, getSegmentBenchmark, isSegment } from '@/lib/brain';
import { getRecommendations, getHistorySummary } from '@/lib/recommend';
import { ingestOwnerPosts } from '@/lib/ingest';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  if (!hasDb) return NextResponse.json({ error: 'db_not_configured' }, { status: 503 });
  const dParam = Number(req.nextUrl.searchParams.get('days'));
  // 0 means the whole history: the ingest walks every post the account ever
  // published, so a 90-day ceiling would hide most of what it collected.
  const days = [0, 7, 30, 90].includes(dParam) ? dParam : 30;
  const tz = req.nextUrl.searchParams.get('tz') || 'UTC';
  const [data, segment] = await Promise.all([getBrain(session.userId, days, tz), getSegment(session.userId)]);
  const [benchmark, recommendations, history] = await Promise.all([
    getSegmentBenchmark(segment),
    getRecommendations(session.userId, segment, tz),
    getHistorySummary(session.userId),
  ]);
  return NextResponse.json({ ...data, segment, benchmark, recommendations, history });
}

/**
 * Set the segment, or pull the account's post history on demand.
 *
 * The history walk is slow and rate limited, so the screen asks for it once
 * and the hourly job keeps it fresh afterwards.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  if (!hasDb) return NextResponse.json({ error: 'db_not_configured' }, { status: 503 });
  const body = await req.json().catch(() => ({}));

  if (body.action === 'ingest') {
    const results = await ingestOwnerPosts(session.userId, { budgetMs: 50_000 });
    const history = await getHistorySummary(session.userId);
    return NextResponse.json({ ok: true, results, history });
  }

  if (!isSegment(body.segment)) return NextResponse.json({ error: 'bad_segment' }, { status: 400 });
  await setSegment(session.userId, body.segment);
  const benchmark = await getSegmentBenchmark(body.segment);
  return NextResponse.json({ ok: true, segment: body.segment, benchmark });
}
