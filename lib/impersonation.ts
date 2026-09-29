/**
 * Read-only guard for the owner's "view as customer" mode.
 *
 * While the owner impersonates a customer, every route that would act on the
 * customer's behalf (toward Meta, toward money, or on their settings) calls
 * blockIfImpersonating() first and returns its 403. Viewing stays open.
 */
import { NextResponse } from 'next/server';
import { getSession } from './session';
import { recordEvent } from './audit';

export const READ_ONLY_CODE = 'impersonation_read_only';
export const READ_ONLY_MESSAGE = 'מצב צפייה כלקוח: פעולות בשם הלקוח חסומות (פרסום, תגובות, הודעות, מחיקה, הפעלה והשהיה של אוטומציות, חיבורים ותשלומים). כדי לפעול, צא ממצב הצפייה.';

export async function blockIfImpersonating(action: string): Promise<NextResponse | null> {
  const s = await getSession();
  if (!s.impersonating) return null;
  await recordEvent(s.impersonating.id, 'impersonation_blocked', { action }, s.realUserId);
  return NextResponse.json({ error: READ_ONLY_MESSAGE, code: READ_ONLY_CODE }, { status: 403 });
}
