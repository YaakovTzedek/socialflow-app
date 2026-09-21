import { NextRequest, NextResponse } from 'next/server';
import { sql, hasDb, ensureSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Sumit IPN. Configure in Sumit: POST https://<host>/api/sumit/webhook?token=<SUMIT_WEBHOOK_SECRET>
// Sumit issues every renewal invoice itself; we log the event and, when we can
// match a standing order, record the invoice and extend the period.
function dig(obj: unknown, keys: string[]): string | null {
  const wanted = keys.map((k) => k.toLowerCase());
  const seen = new Set<unknown>(); const stack: unknown[] = [obj];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
    seen.add(cur);
    for (const [k, v] of Object.entries(cur as Record<string, unknown>)) {
      if (wanted.includes(k.toLowerCase()) && (typeof v === 'string' || typeof v === 'number')) return String(v);
      if (v && typeof v === 'object') stack.push(v);
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const secret = process.env.SUMIT_WEBHOOK_SECRET;
  if (secret && req.nextUrl.searchParams.get('token') !== secret) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!hasDb) return NextResponse.json({ ok: true });
  let body: unknown;
  const ct = req.headers.get('content-type') || '';
  try { body = ct.includes('json') ? await req.json() : Object.fromEntries(new URLSearchParams(await req.text())); } catch { body = {}; }
  await ensureSchema();
  await sql!`INSERT INTO webhook_events (object, body) VALUES ('sumit', ${JSON.stringify(body).slice(0, 4000)})`;
  const recurringId = dig(body, ['RecurringCustomerItemID', 'RecurringID']);
  const documentId = dig(body, ['DocumentID']);
  const paymentId = dig(body, ['PaymentID', 'ID']);
  const amount = Number(dig(body, ['Amount', 'TotalAmount', 'Total']) || 0);
  const pdf = dig(body, ['DocumentDownloadURL', 'DownloadURL']);
  if (recurringId) {
    const [sub] = await sql!`SELECT id, owner_id, interval, currency FROM subscriptions WHERE sumit_recurring_id = ${recurringId} AND status IN ('trialing','active') LIMIT 1`;
    if (sub) {
      const end = new Date(); if (sub.interval === 'year') end.setUTCFullYear(end.getUTCFullYear() + 1); else end.setUTCMonth(end.getUTCMonth() + 1);
      await sql!`UPDATE subscriptions SET status = 'active', current_period_end = ${end} WHERE id = ${sub.id}`;
      await sql!`INSERT INTO invoices (owner_id, subscription_id, sumit_document_id, sumit_payment_id, amount_agorot, currency, pdf_url, status, raw)
                 VALUES (${sub.owner_id}, ${sub.id}, ${documentId}, ${paymentId}, ${Math.round(amount * 100)}, ${sub.currency}, ${pdf}, 'paid', ${sql!.json(body as any)})`;
    }
  }
  return NextResponse.json({ ok: true });
}
