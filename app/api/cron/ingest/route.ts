import { NextRequest, NextResponse } from 'next/server';
import { hasDb } from '@/lib/db';
import { ingestOwnerPosts, ownersNeedingIngest } from '@/lib/ingest';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Hourly: refresh the post history of the accounts that are most out of date.
 * A few owners per pass, so a growing customer base spreads across the hour
 * instead of trying to walk every account inside one function.
 */
export async function GET(req: NextRequest) {
  const bearer = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || bearer !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!hasDb) return NextResponse.json({ error: 'db_not_configured' }, { status: 503 });

  const owners = await ownersNeedingIngest(3);
  const results = [];
  const started = Date.now();
  for (const owner of owners) {
    if (Date.now() - started > 45_000) break;
    results.push(...(await ingestOwnerPosts(owner, { budgetMs: 45_000 - (Date.now() - started) })));
  }
  return NextResponse.json({ ok: true, owners: owners.length, results });
}
