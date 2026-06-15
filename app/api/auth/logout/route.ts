import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getBaseUrl } from '@/lib/url';

export async function GET() {
  const session = await getSession();
  session.destroy();
  return NextResponse.redirect(`${getBaseUrl()}/`);
}
