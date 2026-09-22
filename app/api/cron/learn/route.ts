import { NextRequest, NextResponse } from 'next/server';
import { hasDb } from '@/lib/db';
import { learnSegments } from '@/lib/brain';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Nightly: rebuild the per-segment benchmarks the Brain screen reads. */
export async function GET(req: NextRequest) {
  const bearer = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || bearer !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!hasDb) return NextResponse.json({ error: 'db_not_configured' }, { status: 503 });
  const res = await learnSegments();
  return NextResponse.json({ ok: true, ...res });
}
