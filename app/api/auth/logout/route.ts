import { NextResponse } from 'next/server';
import { getRawSession } from '@/lib/session';
import { recordEvent } from '@/lib/audit';
import { isOwnerId } from '@/lib/owner';
import { getBaseUrl } from '@/lib/url';

export async function GET() {
  const session = await getRawSession();
  const imp = session.impersonate;
  if (imp?.id && isOwnerId(session.userId)) {
    await recordEvent(imp.id, 'impersonation_stop', { reason: 'logout', seconds: Math.round((Date.now() - imp.startedAt) / 1000) }, session.userId);
  }
  session.destroy();
  return NextResponse.redirect(`${getBaseUrl()}/`);
}
